import { createHash } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { LRUCache } from 'lru-cache'

import type { ReleaseDetails, ReleaseSummary } from '../core/types'

import { db } from '../core/db'
import { env } from '../core/env'
import { featuredCache as featuredCacheTable, releaseCache as releaseCacheTable, searchCache as searchCacheTable } from '../core/schema'

const DISCOGS_BASE = 'https://api.discogs.com'
const sanitizeDiscogsCredential = (value?: string) => {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const placeholderPattern = /^(your_|replace_|example|changeme|token_here|key_here|secret_here)/i
  if (placeholderPattern.test(trimmed)) return undefined
  return trimmed
}
const DISCOGS_TOKEN = sanitizeDiscogsCredential(env.DISCOGS_TOKEN)
const DISCOGS_KEY = sanitizeDiscogsCredential(env.DISCOGS_KEY)
const DISCOGS_SECRET = sanitizeDiscogsCredential(env.DISCOGS_SECRET)
const DISCOGS_USER_AGENT = env.DISCOGS_USER_AGENT

const DISCOGS_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 5 + 1000 * 60 * 55
const RELEASE_CACHE_WINDOW = DISCOGS_CACHE_MAX_AGE_MS
const FEATURED_DB_CACHE_WINDOW = env.FEATURED_CACHE_TTL_MS
const SEARCH_DB_CACHE_WINDOW = env.SEARCH_CACHE_TTL_MS
const FEATURED_RETRY_COOLDOWN_MS = env.FEATURED_RETRY_COOLDOWN_MS
const SEARCH_RETRY_COOLDOWN_MS = env.SEARCH_RETRY_COOLDOWN_MS
const FEATURED_REFRESH_SIZE = 50
const FEATURED_DETAIL_HYDRATION_LIMIT = env.FEATURED_DETAIL_HYDRATION_LIMIT
const SEARCH_CACHE_VERSION = 'v10'
const SEARCH_RESULTS_PER_PAGE = 50
const SEARCH_MAX_PAGES = env.SEARCH_MAX_PAGES
const SEARCH_QUERY_PAGES = env.SEARCH_QUERY_PAGES
const SEARCH_MIN_RESULTS_BEFORE_PAGING = env.SEARCH_MIN_RESULTS_BEFORE_PAGING
const SEARCH_ARTIST_CANDIDATE_LIMIT = 3
const SMART_SEARCH_RESULT_LIMIT = 12
const EXPANDED_SEARCH_RESULT_LIMIT = 60
const SMART_SEARCH_PRIMARY_LIMIT = 6
const SMART_SEARCH_STRONG_MATCH_THRESHOLD = 0.72
const SMART_SEARCH_CLOSE_MATCH_THRESHOLD = 0.56
const SMART_SEARCH_CORRECTION_TRIGGER_SCORE = 0.7
const DISCOGS_MIN_REQUEST_INTERVAL_MS = env.DISCOGS_MIN_REQUEST_INTERVAL_MS
const DISCOGS_MAX_RETRIES = env.DISCOGS_MAX_RETRIES
const DISCOGS_REQUEST_TIMEOUT_MS = env.DISCOGS_REQUEST_TIMEOUT_MS
const RELEASE_CACHE_MAX_ENTRIES = env.RELEASE_CACHE_MAX_ENTRIES

// ── In-memory LRU cache to protect RAM and speed up repeat requests ──
const releaseMemoryCache = new LRUCache<string, ReleaseDetails>({
  max: 1000, // Limit to 1000 items (approx 2-3MB total RAM)
  ttl: 1000 * 60 * 15, // 15 minute in-memory TTL
})

// ── Request deduplication Map ──
const releaseRequestsInFlight = new Map<string, Promise<ReleaseDetails>>()

type RankedSearchBatch = {
  data: ReleaseSummary[]
  bestMatchScore: number
  total: number
}

const featuredRefreshInFlight = new Map<string, Promise<ReleaseSummary[]>>()
const searchRefreshInFlight = new Map<string, Promise<RankedSearchBatch>>()
let discogsNextRequestAt = 0

const HEADERS: Record<string, string> = {
  'User-Agent': DISCOGS_USER_AGENT,
  Accept: 'application/json',
}

const setBoundedCacheEntry = <T>(cache: Map<string, T>, key: string, value: T, maxEntries: number) => {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) break
    cache.delete(oldestKey)
  }
}

const parseGenreSource = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

const parseGenres = (release: any) => {
  const merged = [
    ...parseGenreSource(release?.genres),
    ...parseGenreSource(release?.genre),
    ...parseGenreSource(release?.styles),
    ...parseGenreSource(release?.style),
  ]

  const unique = new Set<string>()
  merged.forEach((entry) => unique.add(entry))
  return Array.from(unique)
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const convertDurationToMs = (duration?: string | number | null) => {
  if (!duration) return 0
  const cleaned = String(duration).trim()
  if (!cleaned) return 0
  if (cleaned.includes(':')) {
    const [minutes, seconds] = cleaned.split(':')
    const mins = parseInt(minutes, 10) || 0
    const secs = parseInt(seconds, 10) || 0
    return mins * 60000 + secs * 1000
  }
  const numericValue = Number.parseFloat(cleaned)
  if (Number.isNaN(numericValue)) return 0
  if (numericValue < 100) return Math.round(numericValue * 60000)
  return Math.round(numericValue < 10000 ? numericValue * 1000 : numericValue)
}

const stripDiscogsDisambiguation = (value = '') => value.replace(/\s*\(\d+\)\s*$/g, '').trim()

const parseArtists = (input: unknown, title = ''): string[] => {
  if (!input) {
    if (title && typeof title === 'string' && title.includes(' - ')) {
      return [stripDiscogsDisambiguation(title.split(' - ')[0].trim())]
    }
    return []
  }
  if (Array.isArray(input)) {
    return input
      .map((artist) => (artist as { name?: string; title?: string })?.name ?? artist?.title ?? '')
      .filter(Boolean)
      .map((name) => stripDiscogsDisambiguation(name))
  }
  if (typeof input === 'string') {
    if (input.includes(' - ')) return [stripDiscogsDisambiguation(input.split(' - ')[0].trim())]
    return [stripDiscogsDisambiguation(input.trim())]
  }
  return []
}

const normalizeRelease = (release: any, fallbackTrackCount = 0): ReleaseDetails | null => {
  if (!release) return null
  const artists =
    parseArtists(release.artists, release.title) ||
    parseArtists(release.extraartists, release.title) ||
    parseArtists(release.artist, release.title) ||
    parseArtists(release.title, release.title)

  const rawTracks = Array.isArray(release.tracklist) ? release.tracklist : []
  const tracklist = rawTracks
    .filter((track: any) => {
      const type = (track.type_ ?? track.type ?? '').toLowerCase()
      // Only include actual tracks (type 'track' or no type but has position)
      return type === 'track' || (!type && track.position)
    })
    .map((track: any, index: number) => ({
      id: `${release.id}-${track.position ?? index}`,
      name: track.title ?? `Track ${index + 1}`,
      duration_ms: convertDurationToMs(track.duration),
      track_number: Number(track.position?.replace(/[^\d]/g, '')) || index + 1,
    }))

  const cover =
    release.images?.[0]?.uri ||
    release.images?.[0]?.resource_url ||
    release.cover_image ||
    release.thumb ||
    release.image_url ||
    ''

  const ratingData = release.community?.rating ?? {}
  const ratingAverage = toFiniteNumber(ratingData.average)
  const ratingCount = toFiniteNumber(ratingData.count)
  const rawName = release.title ?? release.name ?? 'Untitled'
  const nameFromTitle =
    typeof rawName === 'string' && rawName.includes(' - ') ? rawName.split(' - ').slice(1).join(' - ').trim() : ''
  const cleanedName = stripDiscogsDisambiguation(nameFromTitle || rawName)

  return {
    id: release.id?.toString(),
    name: cleanedName || 'Untitled',
    artists: artists.length ? artists : ['Unknown Artist'],
    releaseDate: release.released ?? release.released_formatted ?? null,
    releaseYear: release.year ?? null,
    cover,
    totalTracks: tracklist.length || release.trackcount || fallbackTrackCount,
    albumType: release.formats?.[0]?.name ?? release.type ?? 'Release',
    label: release.labels?.[0]?.name,
    popularity: release.community?.have ?? release.community?.want ?? 50,
    external_urls: {
      discogs: release.uri,
    },
    genres: parseGenres(release),
    communityRating: Number((ratingAverage ?? 0).toFixed(1)),
    reviewCount: Math.max(0, Math.round(ratingCount ?? 0)),
    tracks: tracklist,
  }
}

const toReleaseSummary = (release: ReleaseDetails | ReleaseSummary): ReleaseSummary => ({
  id: release.id,
  name: release.name,
  artists: Array.isArray(release.artists) ? release.artists : [],
  releaseDate: release.releaseDate ?? null,
  releaseYear: release.releaseYear ?? null,
  cover: release.cover ?? '',
  totalTracks: Number(release.totalTracks ?? 0),
  albumType: release.albumType ?? 'Release',
  label: release.label,
  popularity: Number(release.popularity ?? 0),
  external_urls: {
    discogs: release.external_urls?.discogs,
  },
  genres: Array.isArray(release.genres) ? release.genres : [],
  communityRating: Number(release.communityRating ?? 0),
  reviewCount: Number(release.reviewCount ?? 0),
})

const toTrack = (track: unknown, index: number) => {
  const entry = (track ?? {}) as Partial<ReleaseDetails['tracks'][number]>
  return {
    id: String(entry.id ?? `track-${index}`).trim() || `track-${index}`,
    name: String(entry.name ?? `Track ${index + 1}`).trim() || `Track ${index + 1}`,
    duration_ms: Number.isFinite(Number(entry.duration_ms)) ? Math.max(0, Math.round(Number(entry.duration_ms))) : 0,
    track_number: Number.isFinite(Number(entry.track_number)) ? Math.max(1, Math.round(Number(entry.track_number))) : index + 1,
  }
}

const toReleaseDetails = (value: unknown): ReleaseDetails | null => {
  if (!value || typeof value !== 'object') return null

  const release = value as Partial<ReleaseDetails>
  const id = String(release.id ?? '').trim()
  if (!id) return null

  return {
    id,
    name: String(release.name ?? 'Untitled').trim() || 'Untitled',
    artists: Array.isArray(release.artists) ? release.artists.filter(Boolean).map(String) : [],
    releaseDate: release.releaseDate ?? null,
    releaseYear: Number.isFinite(Number(release.releaseYear)) ? Number(release.releaseYear) : null,
    cover: String(release.cover ?? '').trim(),
    totalTracks: Number.isFinite(Number(release.totalTracks)) ? Math.max(0, Math.round(Number(release.totalTracks))) : 0,
    albumType: String(release.albumType ?? 'Release').trim() || 'Release',
    label: release.label ? String(release.label).trim() : undefined,
    popularity: Number.isFinite(Number(release.popularity)) ? Math.max(0, Math.round(Number(release.popularity))) : 0,
    external_urls: {
      discogs: release.external_urls?.discogs ? String(release.external_urls.discogs).trim() : undefined,
    },
    genres: Array.isArray(release.genres) ? release.genres.filter(Boolean).map(String) : [],
    communityRating: Number.isFinite(Number(release.communityRating)) ? Number(release.communityRating) : 0,
    reviewCount: Number.isFinite(Number(release.reviewCount)) ? Math.max(0, Math.round(Number(release.reviewCount))) : 0,
    tracks: Array.isArray(release.tracks) ? release.tracks.map(toTrack) : [],
  }
}

const getCachedReleaseDetails = async (releaseId: string) => {
  const rows = await db.select().from(releaseCacheTable).where(eq(releaseCacheTable.releaseId, releaseId)).limit(1)
  const cached = rows[0]
  if (!cached) return null
  if (!isNotExpired(cached.expiresAt) || !isDiscogsCacheFresh(cached.refreshedAt)) return null
  return toReleaseDetails(cached.payload)
}

const upsertReleaseDetailsCache = async (release: ReleaseDetails) => {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + RELEASE_CACHE_WINDOW)

  await db
    .insert(releaseCacheTable)
    .values({
      releaseId: release.id,
      payload: release,
      expiresAt,
      refreshedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: releaseCacheTable.releaseId,
      set: {
        payload: release,
        expiresAt,
        refreshedAt: now,
        updatedAt: now,
      },
    })
}

export const requestDiscogs = async (endpoint: string, params: Record<string, string | number | undefined> = {}) => {
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const throttleDiscogs = async () => {
    const now = Date.now()
    const waitMs = Math.max(0, discogsNextRequestAt - now)
    discogsNextRequestAt = Math.max(discogsNextRequestAt, now) + DISCOGS_MIN_REQUEST_INTERVAL_MS
    if (waitMs > 0) await wait(waitMs)
  }

  const parseRetryAfterMs = (headerValue: string | null) => {
    if (!headerValue) return null
    const seconds = Number.parseFloat(headerValue)
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.round(seconds * 1000)
    }
    const asDate = new Date(headerValue)
    if (!Number.isNaN(asDate.getTime())) {
      return Math.max(0, asDate.getTime() - Date.now())
    }
    return null
  }

  const jitterMs = () => Math.round(Math.random() * 150)
  const backoffMs = (attempt: number) => Math.min(8000, 500 * 2 ** attempt) + jitterMs()

  const makeUrl = (useTokenQuery = false) => {
    const url = new URL(`${DISCOGS_BASE}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.append(key, String(value))
    })
    if (DISCOGS_KEY && DISCOGS_SECRET) {
      url.searchParams.append('key', DISCOGS_KEY)
      url.searchParams.append('secret', DISCOGS_SECRET)
    }
    if (useTokenQuery && DISCOGS_TOKEN) url.searchParams.append('token', DISCOGS_TOKEN)
    return url
  }

  const makeHeaders = (useTokenHeader = true) => {
    const headers = { ...HEADERS }
    if (useTokenHeader && DISCOGS_TOKEN) headers.Authorization = `Discogs token=${DISCOGS_TOKEN}`
    return headers
  }

  const fetchWithAuthFallback = async () => {
    const fetchWithTimeout = async (url: URL, headers: Record<string, string>) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), DISCOGS_REQUEST_TIMEOUT_MS)
      try {
        return await fetch(url, { headers, signal: controller.signal })
      } finally {
        clearTimeout(timeout)
      }
    }

    await throttleDiscogs()
    let response = await fetchWithTimeout(makeUrl(false), makeHeaders(true))

    // Some Discogs setups only accept user token via query param.
    if (response.status === 401 && DISCOGS_TOKEN) {
      await throttleDiscogs()
      response = await fetchWithTimeout(makeUrl(true), makeHeaders(false))
    }

    // If token auth fails entirely and no key/secret exists, retry as anonymous public request.
    if (response.status === 401 && DISCOGS_TOKEN && !(DISCOGS_KEY && DISCOGS_SECRET)) {
      await throttleDiscogs()
      response = await fetchWithTimeout(makeUrl(false), makeHeaders(false))
    }

    return response
  }

  for (let attempt = 0; attempt <= DISCOGS_MAX_RETRIES; attempt += 1) {
    let response: Response
    try {
      response = await fetchWithAuthFallback()
    } catch (error) {
      if (attempt >= DISCOGS_MAX_RETRIES) throw error
      const delayMs = backoffMs(attempt)
      discogsNextRequestAt = Math.max(discogsNextRequestAt, Date.now() + delayMs)
      await wait(delayMs)
      continue
    }
    if (response.ok) {
      return response.json()
    }

    const retryableStatus = response.status === 429 || response.status >= 500
    if (retryableStatus && attempt < DISCOGS_MAX_RETRIES) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'))
      const delayMs = Math.max(backoffMs(attempt), retryAfterMs ?? 0)
      discogsNextRequestAt = Math.max(discogsNextRequestAt, Date.now() + delayMs)
      await wait(delayMs)
      continue
    }

    const errorBody = await response.text().catch(() => '')
    const hasCredentials = Boolean(DISCOGS_TOKEN || (DISCOGS_KEY && DISCOGS_SECRET))
    const reason = errorBody ? ` - ${errorBody.slice(0, 200)}` : ''
    throw new Error(`Discogs request failed: ${response.status}${hasCredentials ? ' (with credentials)' : ''}${reason}`)
  }

  throw new Error('Discogs request failed: exhausted retries')
}

const isFresh = (timestamp: number, ttl = RELEASE_CACHE_WINDOW) => Date.now() - timestamp < ttl
const isNotExpired = (expiresAt: Date | null | undefined) => Boolean(expiresAt && expiresAt.getTime() > Date.now())
export const isDiscogsCacheFresh = (refreshedAt: Date | null | undefined) =>
  Boolean(refreshedAt && Date.now() - refreshedAt.getTime() < DISCOGS_CACHE_MAX_AGE_MS)
const normalizeCacheQuery = (query: string) => query.trim().toLowerCase().replace(/\s+/g, ' ')
const createQueryHash = (query: string) => createHash('sha256').update(`${SEARCH_CACHE_VERSION}:${query}`).digest('hex')

const toReleaseSummaryArray = (value: unknown): ReleaseSummary[] => {
  if (!Array.isArray(value)) return []
  return value.filter(Boolean).map((entry) => toReleaseSummary(entry as ReleaseSummary))
}

const variantMarkers = [
  'deluxe',
  'expanded',
  'remaster',
  'reissue',
  'anniversary',
  'edition',
  'version',
  'mono',
  'stereo',
  'bonus',
  'special',
  'collector',
  'promo',
  'test pressing',
]

const bannedAlbumTypes = ['unofficial', 'promo', 'test pressing', 'advance']

const normalizeWhitespace = (value = '') => value.replace(/\s+/g, ' ').trim()

const hasVariantMarker = (value = '') => {
  const lower = value.toLowerCase()
  return variantMarkers.some((marker) => lower.includes(marker))
}

const cleanAlbumName = (release: ReleaseSummary) => {
  const primaryArtist = release.artists?.[0] ?? ''
  let name = release.name ?? ''
  if (primaryArtist && name.toLowerCase().startsWith(`${primaryArtist.toLowerCase()} - `)) {
    name = name.slice(primaryArtist.length + 3)
  }
  name = name.replace(/\(([^)]*)\)/g, (full, inner) => (hasVariantMarker(inner) ? ' ' : full))
  name = name.replace(/\[([^\]]*)\]/g, (full, inner) => (hasVariantMarker(inner) ? ' ' : full))
  name = name.replace(
    /\b(deluxe|expanded|remaster(?:ed)?|reissue|anniversary|special|collector(?:'s)?|bonus)\b[^-–—]*$/i,
    '',
  )
  return normalizeWhitespace(name).toLowerCase()
}

const isReleasedAlbum = (release: ReleaseSummary) => {
  const hasReleaseDate = Boolean(release.releaseYear || (release.releaseDate && release.releaseDate !== '0'))
  if (!hasReleaseDate) return false
  const currentYear = new Date().getFullYear()
  if (Number(release.releaseYear ?? 0) > currentYear) return false
  const albumType = release.albumType?.toLowerCase?.() ?? ''
  if (bannedAlbumTypes.some((item) => albumType.includes(item))) return false
  return true
}

const releaseScore = (release: ReleaseSummary) => {
  let score = 0
  if (release.releaseYear) score += 5
  if (release.cover) score += 3
  if ((release.reviewCount ?? 0) > 0) score += 2
  if (release.communityRating && release.communityRating > 0) score += Math.floor(release.communityRating)
  
  const albumType = String(release.albumType ?? '').toLowerCase()
  if (albumType === 'album' || albumType === 'lp') score += 10
  if (albumType.includes('single') || albumType.includes('ep')) score -= 5
  if (hasVariantMarker(release.name)) score -= 10
  
  // High popularity boost
  if (release.popularity && release.popularity > 500) score += 5

  return score
}

const dedupeReleasedAlbums = (releases: ReleaseSummary[]) => {
  const picked = new Map<string, ReleaseSummary>()
  for (const release of releases) {
    if (!isReleasedAlbum(release)) continue
    const primaryArtist = (release.artists?.[0] ?? 'unknown artist').toLowerCase()
    const canonicalName = cleanAlbumName(release)
    const key = `${primaryArtist}::${canonicalName || release.name?.toLowerCase() || release.id}`
    const current = picked.get(key)
    if (!current || releaseScore(release) > releaseScore(current)) {
      picked.set(key, release)
    }
  }
  return Array.from(picked.values())
}

const dedupeByReleaseId = (releases: ReleaseSummary[]) => {
  const picked = new Map<string, ReleaseSummary>()

  for (const release of releases) {
    const id = String(release?.id ?? '').trim()
    if (!id) continue

    const current = picked.get(id)
    if (!current) {
      picked.set(id, release)
      continue
    }

    const currentQuality = releaseScore(current) + Number(current.reviewCount ?? 0)
    const candidateQuality = releaseScore(release) + Number(release.reviewCount ?? 0)
    if (candidateQuality >= currentQuality) {
      picked.set(id, release)
    }
  }

  return Array.from(picked.values())
}

const hydrateReleasesWithDetails = async (releases: ReleaseSummary[]) => {
  const unique = dedupeByReleaseId(releases)
  const hydrationTargetIds = new Set(
    unique
      .filter((release) => !release.cover || Number(release.reviewCount ?? 0) <= 0)
      .sort((a, b) => Number(b.popularity ?? 0) - Number(a.popularity ?? 0))
      .slice(0, FEATURED_DETAIL_HYDRATION_LIMIT)
      .map((release) => String(release.id)),
  )

  const hydrated = await Promise.allSettled(
    unique.map(async (release) => {
      const releaseId = String(release?.id ?? '').trim()
      if (!releaseId) return toReleaseSummary(release)

      if (!hydrationTargetIds.has(releaseId)) return toReleaseSummary(release)

      const hasCommunityStats = Number(release.reviewCount ?? 0) > 0
      const hasCover = Boolean(release.cover)
      if (hasCommunityStats && hasCover) return toReleaseSummary(release)

      try {
        const details = await getReleaseDetails(releaseId)
        return toReleaseSummary({
          ...release,
          ...details,
        })
      } catch {
        return toReleaseSummary(release)
      }
    }),
  )

  return dedupeByReleaseId(
    hydrated
      .filter((entry): entry is PromiseFulfilledResult<ReleaseSummary> => entry.status === 'fulfilled')
      .map((entry) => entry.value),
  )
}

const sortReleasedAlbumsChronologically = (releases: ReleaseSummary[], preferredArtists: string[] = []) => {
  const preferred = preferredArtists.map((artist) => normalizeCacheQuery(artist))
  const getArtistRank = (release: ReleaseSummary) => {
    const primaryArtist = normalizeCacheQuery(release.artists?.[0] ?? '')
    const index = preferred.indexOf(primaryArtist)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }

  return [...releases].sort((a, b) => {
    const rankDiff = getArtistRank(a) - getArtistRank(b)
    if (rankDiff !== 0) return rankDiff

    const yearA = Number(a.releaseYear ?? 0)
    const yearB = Number(b.releaseYear ?? 0)
    if (yearA !== yearB) return yearA - yearB

    const nameDiff = (a.name ?? '').localeCompare(b.name ?? '')
    if (nameDiff !== 0) return nameDiff

    return (a.artists?.[0] ?? '').localeCompare(b.artists?.[0] ?? '')
  })
}

const mapDiscogsSearchResults = (results: any[]): ReleaseSummary[] =>
  results
    .map((entry: any) => {
      const normalized = normalizeRelease({
        ...entry,
        id: `r:${entry.id}`,
        title: entry.title,
        artist: entry.artist,
        year: entry.year,
        cover_image: entry.cover_image,
        thumb: entry.thumb,
        genres: entry.genre,
        styles: entry.style,
        labels: entry.label ? [{ name: entry.label }] : undefined,
        formats: entry.format ? [{ name: entry.format }] : undefined,
        uri: entry.uri,
        community: entry.community,
      })
      return normalized ? toReleaseSummary(normalized) : null
    })
    .filter(Boolean) as ReleaseSummary[]

const mapDiscogsMasterSearchResults = (results: any[]): ReleaseSummary[] =>
  results
    .map((entry: any) => {
      const id = entry.id
      if (!id) return null
      const formatName = Array.isArray(entry.format)
        ? entry.format.filter(Boolean).map(String).join(' / ')
        : String(entry.format ?? '').trim()
      const labelName = Array.isArray(entry.label)
        ? String(entry.label[0] ?? '').trim()
        : String(entry.label ?? '').trim()
      const year = Number(entry.year)
      const normalized = normalizeRelease({
        id: `m:${id}`,
        title: entry.title,
        artist: entry.artist,
        year: Number.isFinite(year) && year > 0 ? year : null,
        cover_image: entry.cover_image,
        thumb: entry.thumb,
        genres: entry.genre,
        styles: entry.style,
        labels: labelName ? [{ name: labelName }] : undefined,
        formats: formatName ? [{ name: formatName }] : [{ name: 'Album' }],
        uri: entry.uri,
        community: entry.community,
      })
      return normalized ? toReleaseSummary(normalized) : null
    })
    .filter(Boolean) as ReleaseSummary[]

export const normalizeSearchValue = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// ─── Fuzzy matching utilities ───────────────────────────────────────────────

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const matrix: number[][] = []
  for (let i = 0; i <= a.length; i++) matrix[i] = [i]
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }
  return matrix[a.length][b.length]
}

const fuzzyScore = (query: string, candidate: string): number => {
  const q = normalizeSearchValue(query)
  const c = normalizeSearchValue(candidate)
  if (!q || !c) return 0
  if (q === c) return 1

  // Token-level overlap (handles word reordering / partial matches)
  const qTokens = q.split(' ').filter(Boolean)
  const cTokens = c.split(' ').filter(Boolean)
  let tokenMatchScore = 0
  for (const qt of qTokens) {
    let bestTokenDist = qt.length
    for (const ct of cTokens) {
      bestTokenDist = Math.min(bestTokenDist, levenshtein(qt, ct))
    }
    // Normalize: 1 = perfect token match, 0 = completely different
    tokenMatchScore += Math.max(0, 1 - bestTokenDist / Math.max(qt.length, 1))
  }
  tokenMatchScore /= qTokens.length

  // Whole-string Levenshtein similarity
  const dist = levenshtein(q, c)
  const maxLen = Math.max(q.length, c.length)
  const stringSimilarity = 1 - dist / maxLen

  return Math.max(tokenMatchScore, stringSimilarity)
}

const FUZZY_SIMILARITY_THRESHOLD = 0.45

const fetchFuzzySuggestions = async (sourceQuery: string): Promise<string | null> => {
  const [masterResultsResponse, artistResultsResponse] = await Promise.all([
    requestDiscogs('/database/search', {
      q: sourceQuery,
      per_page: 20,
      type: 'master',
      format: 'album',
    }),
    requestDiscogs('/database/search', {
      q: sourceQuery,
      per_page: 15,
      type: 'artist',
    }),
  ])

  const masterResults = Array.isArray(masterResultsResponse?.results) ? masterResultsResponse.results : []
  const artistResults = Array.isArray(artistResultsResponse?.results) ? artistResultsResponse.results : []
  const results = [...masterResults, ...artistResults]
  if (!results.length) return null

  let bestCandidate: string | null = null
  let bestScore = 0

  for (const entry of results) {
    const title = typeof entry?.title === 'string' ? stripDiscogsDisambiguation(entry.title) : ''
    const artist = extractMasterArtist(entry)
    const album = extractMasterAlbum(entry)
    const candidates = [title, artist, album].filter(Boolean)

    for (const candidate of candidates) {
      const score = fuzzyScore(sourceQuery, candidate)
      if (score > bestScore && score >= FUZZY_SIMILARITY_THRESHOLD) {
        bestScore = score
        bestCandidate = candidate
      }
    }
  }

  return bestCandidate
}

const toNormalizedTokens = (value: string) => normalizeSearchValue(value).split(' ').filter(Boolean)

const countGenreMatches = (seedGenres: Set<string>, release: ReleaseSummary) => {
  if (!seedGenres.size || !release.genres?.length) return 0
  const normalizedGenres = release.genres.map((genre) => normalizeSearchValue(genre)).filter(Boolean)
  return normalizedGenres.reduce((count, genre) => (seedGenres.has(genre) ? count + 1 : count), 0)
}

type ScoredRelease = {
  release: ReleaseSummary
  intentScore: number
  rankScore: number
  isExactNameMatch: boolean
  isExactArtistMatch: boolean
  isExactArtistAlbumMatch: boolean
}

const scoreReleaseAgainstQuery = (release: ReleaseSummary, sourceQuery: string): ScoredRelease => {
  const normalizedQuery = normalizeSearchValue(sourceQuery)
  const queryTokens = toNormalizedTokens(sourceQuery)
  const normalizedName = normalizeSearchValue(release.name ?? '')
  const normalizedArtists = (release.artists ?? []).map((artist) => normalizeSearchValue(artist)).filter(Boolean)
  const normalizedArtistAlbums = normalizedArtists.map((artist) => `${artist} ${normalizedName}`.trim())
  const albumType = normalizeSearchValue(release.albumType ?? '')

  const nameFuzzy = fuzzyScore(normalizedQuery, normalizedName)
  const bestArtistFuzzy = normalizedArtists.reduce(
    (best, artist) => Math.max(best, fuzzyScore(normalizedQuery, artist)),
    0,
  )
  const bestArtistAlbumFuzzy = normalizedArtistAlbums.reduce(
    (best, artistAlbum) => Math.max(best, fuzzyScore(normalizedQuery, artistAlbum)),
    0,
  )

  const tokenCoverage = queryTokens.length
    ? queryTokens.filter((token) => normalizedName.includes(token) || normalizedArtists.some((artist) => artist.includes(token))).length /
      queryTokens.length
    : 0

  const exactName = normalizedName === normalizedQuery
  const exactArtist = normalizedArtists.includes(normalizedQuery)
  const exactArtistAlbum = normalizedArtistAlbums.includes(normalizedQuery)
  const startsWithMatch =
    normalizedName.startsWith(normalizedQuery) ||
    normalizedArtists.some((artist) => artist.startsWith(normalizedQuery)) ||
    normalizedArtistAlbums.some((artistAlbum) => artistAlbum.startsWith(normalizedQuery))
  const includesMatch =
    normalizedName.includes(normalizedQuery) ||
    normalizedArtists.some((artist) => artist.includes(normalizedQuery)) ||
    normalizedArtistAlbums.some((artistAlbum) => artistAlbum.includes(normalizedQuery))

  let intentScore = Math.max(nameFuzzy * 0.94, bestArtistFuzzy, bestArtistAlbumFuzzy, tokenCoverage * 0.9)
  if (exactName || exactArtist || exactArtistAlbum) intentScore += 0.42
  else if (startsWithMatch) intentScore += 0.22
  else if (includesMatch) intentScore += 0.1

  if (albumType.includes('single') || albumType.includes('ep')) {
    intentScore -= 0.08
  }

  const qualityBoost =
    Math.min(Number(release.popularity ?? 0) / 6000, 0.22) +
    Math.min(Number(release.reviewCount ?? 0) / 250, 0.18) +
    Math.min(Math.max(Number(release.communityRating ?? 0), 0) / 10, 0.12)

  const rankScore = intentScore * 0.84 + qualityBoost * 0.16

  return {
    release,
    intentScore: Math.max(0, Number(intentScore.toFixed(4))),
    rankScore: Number(rankScore.toFixed(4)),
    isExactNameMatch: exactName,
    isExactArtistMatch: exactArtist,
    isExactArtistAlbumMatch: exactArtistAlbum,
  }
}

export const buildSmartSearchResults = (
  releases: ReleaseSummary[],
  sourceQuery: string,
  limit = SMART_SEARCH_RESULT_LIMIT,
): RankedSearchBatch => {
  const safeLimit = Math.min(Math.max(Math.round(limit), 1), EXPANDED_SEARCH_RESULT_LIMIT)
  const ranked = dedupeByReleaseId(releases)
    .map((release) => scoreReleaseAgainstQuery(release, sourceQuery))
    .filter((entry) => entry.intentScore > 0)
    .sort((a, b) => {
      const intentDiff = b.intentScore - a.intentScore
      if (intentDiff !== 0) return intentDiff
      const rankDiff = b.rankScore - a.rankScore
      if (rankDiff !== 0) return rankDiff
      return releaseScore(b.release) - releaseScore(a.release)
    })

  const bestMatchScore = ranked[0]?.intentScore ?? 0

  const exactMatches = ranked.filter(
    (entry) => entry.isExactNameMatch || entry.isExactArtistMatch || entry.isExactArtistAlbumMatch,
  )
  if (exactMatches.length > safeLimit) {
    return {
      data: exactMatches.slice(0, safeLimit).map((entry) => entry.release),
      bestMatchScore,
      total: exactMatches.length,
    }
  }

  const selected = new Map<string, ReleaseSummary>()
  exactMatches.forEach((entry) => {
    selected.set(entry.release.id, entry.release)
  })

  const remainingRanked = ranked.filter((entry) => !selected.has(entry.release.id))

  const strongPrimary = remainingRanked.filter((entry) => entry.intentScore >= SMART_SEARCH_STRONG_MATCH_THRESHOLD)
  const closePrimary = remainingRanked.filter((entry) => entry.intentScore >= SMART_SEARCH_CLOSE_MATCH_THRESHOLD)
  const primaryPool = strongPrimary.length ? strongPrimary : closePrimary.length ? closePrimary : remainingRanked
  const primarySlots = Math.max(0, Math.min(SMART_SEARCH_PRIMARY_LIMIT, safeLimit) - selected.size)
  const primary = primaryPool.slice(0, primarySlots)
  primary.forEach((entry) => {
    selected.set(entry.release.id, entry.release)
  })

  const seedGenres = new Set(
    primary
      .flatMap((entry) => entry.release.genres ?? [])
      .map((genre) => normalizeSearchValue(genre))
      .filter(Boolean),
  )

  const similar = remainingRanked
    .filter((entry) => !selected.has(entry.release.id))
    .map((entry) => ({
      ...entry,
      genreMatches: countGenreMatches(seedGenres, entry.release),
    }))
    .filter((entry) => entry.genreMatches > 0 || entry.intentScore >= SMART_SEARCH_CLOSE_MATCH_THRESHOLD)
    .sort((a, b) => {
      const genreDiff = b.genreMatches - a.genreMatches
      if (genreDiff !== 0) return genreDiff
      const rankDiff = b.rankScore - a.rankScore
      if (rankDiff !== 0) return rankDiff
      return releaseScore(b.release) - releaseScore(a.release)
    })

  for (const entry of similar) {
    if (selected.size >= safeLimit) break
    selected.set(entry.release.id, entry.release)
  }

  if (selected.size < safeLimit) {
    for (const entry of remainingRanked) {
      if (selected.size >= safeLimit) break
      if (selected.has(entry.release.id)) continue
      selected.set(entry.release.id, entry.release)
    }
  }

  return {
    data: Array.from(selected.values()).slice(0, safeLimit),
    bestMatchScore,
    total: ranked.length,
  }
}

const extractMasterArtist = (entry: any) => {
  const fromTitle =
    typeof entry?.title === 'string' && entry.title.includes(' - ') ? entry.title.split(' - ')[0]?.trim() : ''
  const fromArtist = typeof entry?.artist === 'string' ? entry.artist.trim() : ''
  const fromArtistsArray = Array.isArray(entry?.artists)
    ? String(entry.artists[0]?.name ?? entry.artists[0]?.title ?? '').trim()
    : ''
  return stripDiscogsDisambiguation(fromTitle || fromArtist || fromArtistsArray)
}

const extractMasterAlbum = (entry: any) => {
  if (typeof entry?.title !== 'string') return ''
  if (!entry.title.includes(' - ')) return stripDiscogsDisambiguation(entry.title)
  return stripDiscogsDisambiguation(entry.title.split(' - ').slice(1).join(' - ').trim())
}

const inferArtistCandidates = (entries: any[], sourceQuery: string) => {
  const normalizedQuery = normalizeSearchValue(sourceQuery)
  const scores = new Map<string, number>()

  for (const entry of entries) {
    const artist = extractMasterArtist(entry)
    if (!artist) continue
    const album = extractMasterAlbum(entry)
    const normalizedArtist = normalizeSearchValue(artist)
    const normalizedAlbum = normalizeSearchValue(album)
    let score = 0

    if (normalizedArtist === normalizedQuery) score += 140
    else if (normalizedArtist.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedArtist)) score += 95
    else if (normalizedArtist.includes(normalizedQuery) || normalizedQuery.includes(normalizedArtist)) score += 70

    if (normalizedAlbum === normalizedQuery) score += 120
    else if (normalizedAlbum.includes(normalizedQuery) || normalizedQuery.includes(normalizedAlbum)) score += 85

    score += Math.min(Number(entry?.community?.have ?? 0) / 1000, 15)
    score += Math.min(Number(entry?.community?.want ?? 0) / 2000, 8)

    if (score <= 0) continue
    const current = scores.get(artist) ?? 0
    scores.set(artist, current + score)
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, SEARCH_ARTIST_CANDIDATE_LIMIT)
    .map(([artist]) => artist)
}

const fetchAllSearchPages = async (
  params: Record<string, string | number | undefined>,
  maxPages = SEARCH_MAX_PAGES,
  minResultsBeforePaging = SEARCH_MIN_RESULTS_BEFORE_PAGING,
) => {
  const firstPage = await requestDiscogs('/database/search', {
    ...params,
    per_page: SEARCH_RESULTS_PER_PAGE,
    page: 1,
  })
  const firstResults = Array.isArray(firstPage?.results) ? firstPage.results : []
  if (firstResults.length >= minResultsBeforePaging) return firstResults

  const totalPages = Math.max(
    1,
    Math.min(Number(firstPage?.pagination?.pages ?? 1) || 1, Math.max(1, maxPages)),
  )
  if (totalPages <= 1) return firstResults

  const results = [...firstResults]
  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await requestDiscogs('/database/search', {
      ...params,
      per_page: SEARCH_RESULTS_PER_PAGE,
      page,
    })
    const nextResults = Array.isArray(nextPage?.results) ? nextPage.results : []
    if (nextResults.length) {
      results.push(...nextResults)
    }
    if (results.length >= minResultsBeforePaging) break
  }

  return results
}

type FeaturedMode = 'featured' | 'recent-popular'

const clampLimit = (value: number, fallback = 24) => {
  const safe = Number.isFinite(value) ? value : fallback
  return Math.min(Math.max(Math.round(safe), 1), FEATURED_REFRESH_SIZE)
}

const shouldRefreshSummaryPayload = (payload: ReleaseSummary[]) => {
  if (!payload.length) return true
  const sample = payload.slice(0, Math.min(payload.length, 24))
  const containsTracksField = sample.some((release) => Array.isArray((release as { tracks?: unknown }).tracks))
  if (containsTracksField) return true
  const albumsWithCommunity = sample.filter(
    (release) => Number(release.reviewCount ?? 0) > 0 && Number(release.communityRating ?? 0) > 0,
  ).length
  return albumsWithCommunity === 0
}

const getCachedFeatured = async (mode: FeaturedMode) => {
  const rows = await db.select().from(featuredCacheTable).where(eq(featuredCacheTable.mode, mode)).limit(1)
  return rows[0]
}

const upsertFeatured = async (mode: FeaturedMode, payload: ReleaseSummary[]) => {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + FEATURED_DB_CACHE_WINDOW)

  await db
    .insert(featuredCacheTable)
    .values({
      mode,
      payload,
      expiresAt,
      refreshedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: featuredCacheTable.mode,
      set: {
        payload,
        expiresAt,
        refreshedAt: now,
        updatedAt: now,
      },
    })
}

export const fetchFeaturedSnapshotFromDiscogs = async (targetSize = FEATURED_REFRESH_SIZE) => {
  const response = await requestDiscogs('/database/search', {
    per_page: Math.max(targetSize * 2, 36),
    type: 'release',
    format: 'album',
    sort: 'have',
    sort_order: 'desc',
  })

  const normalized = mapDiscogsSearchResults(response.results ?? [])
  const curated = dedupeReleasedAlbums(normalized)
  const trimmed = curated.slice(0, targetSize)
  return hydrateReleasesWithDetails(trimmed)
}

const fetchRecentPopularFromDiscogs = async (targetSize = FEATURED_REFRESH_SIZE) => {
  const response = await requestDiscogs('/database/search', {
    per_page: Math.max(targetSize * 4, 96),
    type: 'release',
    format: 'album',
    sort: 'year',
    sort_order: 'desc',
  })

  const normalized = mapDiscogsSearchResults(response.results ?? [])
  const curated = dedupeReleasedAlbums(normalized)
  const currentYear = new Date().getFullYear()
  const recentStartYear = currentYear - 2

  const recentFirst = curated
    .filter((release) => Number(release.releaseYear ?? 0) >= recentStartYear)
    .sort(
      (a, b) =>
        Number(b.releaseYear ?? 0) - Number(a.releaseYear ?? 0) || Number(b.popularity ?? 0) - Number(a.popularity ?? 0),
    )

  const olderFallback = curated
    .filter((release) => Number(release.releaseYear ?? 0) < recentStartYear)
    .sort(
      (a, b) =>
        Number(b.popularity ?? 0) - Number(a.popularity ?? 0) || Number(b.releaseYear ?? 0) - Number(a.releaseYear ?? 0),
    )

  const ranked = [...recentFirst, ...olderFallback]
  return hydrateReleasesWithDetails(ranked.slice(0, targetSize))
}

const getIsoWeekNumber = (date: Date) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  return Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const parseReleaseDateValue = (release: ReleaseSummary) => {
  const rawDate = String(release.releaseDate ?? '').trim()
  if (rawDate) {
    const parsed = new Date(rawDate)
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime()

    const yearMonthMatch = rawDate.match(/^(\d{4})-(\d{2})$/)
    if (yearMonthMatch) {
      const parsedMonth = new Date(`${yearMonthMatch[1]}-${yearMonthMatch[2]}-01`)
      if (!Number.isNaN(parsedMonth.getTime())) return parsedMonth.getTime()
    }

    const yearMatch = rawDate.match(/^(\d{4})$/)
    if (yearMatch) {
      return new Date(`${yearMatch[1]}-01-01`).getTime()
    }
  }

  if (Number(release.releaseYear ?? 0) > 0) {
    return new Date(`${release.releaseYear}-01-01`).getTime()
  }

  return 0
}

export const fetchRecentReleaseCandidatesFromDiscogs = async (targetSize = FEATURED_REFRESH_SIZE * 3) => {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const isoWeek = getIsoWeekNumber(currentDate)
  const rotatingPage = Math.max(1, (isoWeek % 4) + 1)
  const perPage = Math.min(100, Math.max(targetSize * 2, 50))
  const requestPlan = [
    { year: currentYear, pages: [1, rotatingPage, rotatingPage + 1] },
    { year: currentYear - 1, pages: [1, rotatingPage] },
  ]

  const responses = await Promise.all(
    requestPlan.flatMap(({ year, pages }) =>
      Array.from(new Set(pages)).map((page) =>
        requestDiscogs('/database/search', {
          per_page: perPage,
          page,
          type: 'release',
          format: 'album',
          year,
          sort: 'year',
          sort_order: 'desc',
        }),
      ),
    ),
  )

  const normalized = responses.flatMap((response) => mapDiscogsSearchResults(response?.results ?? []))
  const curated = dedupeReleasedAlbums(normalized)
  const now = currentDate.getTime()
  const recentWindowStart = new Date(currentYear - 1, 0, 1).getTime()

  const ranked = curated
    .filter((release) => parseReleaseDateValue(release) >= recentWindowStart || Number(release.releaseYear ?? 0) >= currentYear - 1)
    .sort((a, b) => {
      const dateDiff = parseReleaseDateValue(b) - parseReleaseDateValue(a)
      if (dateDiff !== 0) return dateDiff

      const agePenaltyA = Math.abs(now - parseReleaseDateValue(a))
      const agePenaltyB = Math.abs(now - parseReleaseDateValue(b))
      if (agePenaltyA !== agePenaltyB) return agePenaltyA - agePenaltyB

      return Number(b.popularity ?? 0) - Number(a.popularity ?? 0)
    })

  return hydrateReleasesWithDetails(ranked.slice(0, Math.max(targetSize, FEATURED_REFRESH_SIZE)))
}

const refreshFeaturedMode = async (mode: FeaturedMode) => {
  const existing = featuredRefreshInFlight.get(mode)
  if (existing) return existing

  const refreshPromise = (async () => {
    const payload =
      mode === 'recent-popular'
        ? await fetchRecentPopularFromDiscogs(FEATURED_REFRESH_SIZE)
        : await fetchFeaturedSnapshotFromDiscogs(FEATURED_REFRESH_SIZE)
    await upsertFeatured(mode, payload)
    return payload
  })()

  featuredRefreshInFlight.set(mode, refreshPromise)
  return refreshPromise.finally(() => {
    featuredRefreshInFlight.delete(mode)
  })
}

const getFeaturedByMode = async (mode: FeaturedMode, limit = 24, forceRefresh = false) => {
  const safeLimit = clampLimit(limit)
  const cached = await getCachedFeatured(mode)
  const cachedPayload = toReleaseSummaryArray(cached?.payload)
  const refreshedAt = cached?.refreshedAt?.getTime?.() ?? 0
  const recentRefresh = refreshedAt > 0 && Date.now() - refreshedAt < FEATURED_RETRY_COOLDOWN_MS

  const cachedNeedsRefresh = shouldRefreshSummaryPayload(cachedPayload)
  if (
    !forceRefresh &&
    cachedPayload.length &&
    isNotExpired(cached?.expiresAt) &&
    isDiscogsCacheFresh(cached?.refreshedAt) &&
    (!cachedNeedsRefresh || recentRefresh)
  ) {
    return cachedPayload.slice(0, safeLimit)
  }

  try {
    const refreshed = await refreshFeaturedMode(mode)
    return refreshed.slice(0, safeLimit)
  } catch {
    if (cachedPayload.length && isDiscogsCacheFresh(cached?.refreshedAt)) {
      return cachedPayload.slice(0, safeLimit)
    }
    throw new Error('Unable to refresh featured releases from Discogs.')
  }
}

export const getFeaturedReleases = async (limit = 24, forceRefresh = false) =>
  getFeaturedByMode('featured', limit, forceRefresh)

export const getRecentPopularReleases = async (limit = 24, forceRefresh = false) =>
  getFeaturedByMode('recent-popular', limit, forceRefresh)

const getCachedSearch = async (queryHash: string) => {
  const rows = await db.select().from(searchCacheTable).where(eq(searchCacheTable.queryHash, queryHash)).limit(1)
  return rows[0]
}

const upsertSearchCache = async (queryHash: string, normalizedQuery: string, payload: ReleaseSummary[]) => {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SEARCH_DB_CACHE_WINDOW)

  await db
    .insert(searchCacheTable)
    .values({
      queryHash,
      normalizedQuery,
      payload,
      expiresAt,
      refreshedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: searchCacheTable.queryHash,
      set: {
        normalizedQuery,
        payload,
        expiresAt,
        refreshedAt: now,
        updatedAt: now,
      },
    })
}

const refreshSearchQuery = async (queryHash: string, normalizedQuery: string, sourceQuery: string): Promise<RankedSearchBatch> => {
  const existing = searchRefreshInFlight.get(queryHash)
  if (existing) return existing

  const refreshPromise = (async () => {
    const queryResults = await fetchAllSearchPages(
      {
        q: sourceQuery,
        type: 'master',
        format: 'album',
      },
      SEARCH_QUERY_PAGES,
      SMART_SEARCH_RESULT_LIMIT,
    )

    const artistCandidates = inferArtistCandidates(queryResults, sourceQuery)
    const artistScopedBatches = await Promise.all(
      artistCandidates.slice(0, SEARCH_ARTIST_CANDIDATE_LIMIT).map((artist) =>
        fetchAllSearchPages(
          {
            artist,
            type: 'master',
            format: 'album',
          },
          Math.min(2, SEARCH_MAX_PAGES),
          SMART_SEARCH_RESULT_LIMIT,
        ),
      ),
    )

    const normalized = mapDiscogsMasterSearchResults([...queryResults, ...artistScopedBatches.flat()])
    const curated = dedupeReleasedAlbums(normalized).filter((release) => {
      const albumType = (release.albumType ?? '').toLowerCase()
      // Broaden filter to catch things labeled slightly differently but still likely albums
      return albumType.includes('album') || albumType.includes('lp') || albumType === 'release' || !albumType
    })

    const rankedChronological = dedupeByReleaseId(sortReleasedAlbumsChronologically(curated, artistCandidates))
    const expanded = buildSmartSearchResults(rankedChronological, sourceQuery, EXPANDED_SEARCH_RESULT_LIMIT)

    await upsertSearchCache(queryHash, normalizedQuery, expanded.data)
    return expanded
  })()

  searchRefreshInFlight.set(queryHash, refreshPromise)
  return refreshPromise.finally(() => {
    searchRefreshInFlight.delete(queryHash)
  })
}

export interface SearchResult {
  data: ReleaseSummary[]
  correctedQuery?: string
  hasMore?: boolean
  nextOffset?: number | null
  total?: number
}

type SearchOptions = {
  limit?: number
  offset?: number
}

const clampSearchLimit = (value: unknown) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return SMART_SEARCH_RESULT_LIMIT
  return Math.min(Math.max(Math.round(numeric), 1), EXPANDED_SEARCH_RESULT_LIMIT)
}

const clampSearchOffset = (value: unknown) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.min(Math.max(Math.round(numeric), 0), EXPANDED_SEARCH_RESULT_LIMIT - 1)
}

const pageSearchBatch = (batch: RankedSearchBatch, limit: number, offset: number): SearchResult => {
  const total = batch.total || batch.data.length
  const data = batch.data.slice(offset, offset + limit)
  const nextOffset = offset + data.length

  return {
    data,
    hasMore: nextOffset < total && nextOffset < EXPANDED_SEARCH_RESULT_LIMIT,
    nextOffset: nextOffset < total && nextOffset < EXPANDED_SEARCH_RESULT_LIMIT ? nextOffset : null,
    total,
  }
}

export const searchReleases = async (query: string, options: SearchOptions = {}): Promise<SearchResult> => {
  const trimmed = query?.trim()
  if (!trimmed) return { data: [] }

  const limit = clampSearchLimit(options.limit)
  const offset = clampSearchOffset(options.offset)
  const normalizedQuery = normalizeCacheQuery(trimmed)
  const queryHash = createQueryHash(normalizedQuery)
  const cached = await getCachedSearch(queryHash)
  const cachedPayload = toReleaseSummaryArray(cached?.payload)
  const refreshedAt = cached?.refreshedAt?.getTime?.() ?? 0
  const recentRefresh = refreshedAt > 0 && Date.now() - refreshedAt < SEARCH_RETRY_COOLDOWN_MS

  const getCorrectedSearchResults = async (corrected: string) => {
    const correctedNorm = normalizeCacheQuery(corrected)
    const correctedHash = createQueryHash(correctedNorm)

    const correctedCached = await getCachedSearch(correctedHash)
    const correctedPayload = toReleaseSummaryArray(correctedCached?.payload)
    const correctedRefreshedAt = correctedCached?.refreshedAt?.getTime?.() ?? 0
    const correctedRecentRefresh = correctedRefreshedAt > 0 && Date.now() - correctedRefreshedAt < SEARCH_RETRY_COOLDOWN_MS

    if (
      correctedPayload.length &&
      isNotExpired(correctedCached?.expiresAt) &&
      isDiscogsCacheFresh(correctedCached?.refreshedAt) &&
      (!shouldRefreshSummaryPayload(correctedPayload) || correctedRecentRefresh)
    ) {
      return buildSmartSearchResults(correctedPayload, corrected, EXPANDED_SEARCH_RESULT_LIMIT)
    }

    return refreshSearchQuery(correctedHash, correctedNorm, corrected)
  }

  if (
    cachedPayload.length &&
    isNotExpired(cached?.expiresAt) &&
    isDiscogsCacheFresh(cached?.refreshedAt) &&
    (!shouldRefreshSummaryPayload(cachedPayload) || recentRefresh)
  ) {
    const cachedSmart = buildSmartSearchResults(cachedPayload, trimmed, EXPANDED_SEARCH_RESULT_LIMIT)
    if (cachedSmart.bestMatchScore >= SMART_SEARCH_CORRECTION_TRIGGER_SCORE) {
      return pageSearchBatch(cachedSmart, limit, offset)
    }

    try {
      const corrected = await fetchFuzzySuggestions(trimmed)
      if (corrected && normalizeSearchValue(corrected) !== normalizeSearchValue(trimmed)) {
        const correctedSmart = await getCorrectedSearchResults(corrected)
        if (correctedSmart.bestMatchScore > cachedSmart.bestMatchScore) {
          return { ...pageSearchBatch(correctedSmart, limit, offset), correctedQuery: corrected }
        }
      }
    } catch {
      // Ignore correction lookup failures and fall back to cached results.
    }

    return pageSearchBatch(cachedSmart, limit, offset)
  }

  try {
    const results = await refreshSearchQuery(queryHash, normalizedQuery, trimmed)

    if (results.data.length && results.bestMatchScore >= SMART_SEARCH_CORRECTION_TRIGGER_SCORE) {
      return pageSearchBatch(results, limit, offset)
    }

    if (results.data.length && results.bestMatchScore >= SMART_SEARCH_CLOSE_MATCH_THRESHOLD) {
      return pageSearchBatch(results, limit, offset)
    }

    // ─── Fuzzy fallback: try to find an approximate match ────────────
    const corrected = await fetchFuzzySuggestions(trimmed)
    if (corrected && normalizeSearchValue(corrected) !== normalizeSearchValue(trimmed)) {
      const correctedResults = await getCorrectedSearchResults(corrected)
      if (correctedResults.data.length && correctedResults.bestMatchScore > results.bestMatchScore) {
        return { ...pageSearchBatch(correctedResults, limit, offset), correctedQuery: corrected }
      }
    }

    return pageSearchBatch(results, limit, offset)
  } catch {
    if (cachedPayload.length && isDiscogsCacheFresh(cached?.refreshedAt)) {
      const cachedSmart = buildSmartSearchResults(cachedPayload, trimmed, EXPANDED_SEARCH_RESULT_LIMIT)
      return pageSearchBatch(cachedSmart, limit, offset)
    }
    throw new Error('Search unavailable right now. Please try again shortly.')
  }
}

export const getReleaseDetails = async (releaseId: string): Promise<ReleaseDetails> => {
  if (!releaseId) throw new Error('Release id missing')

  // 1. Check in-memory LRU first (fastest)
  const memoryCached = releaseMemoryCache.get(releaseId)
  if (memoryCached) return memoryCached

  // 2. Check persistent DB cache next
  try {
    const cached = await getCachedReleaseDetails(releaseId)
    if (cached) {
      releaseMemoryCache.set(releaseId, cached)
      return cached
    }
  } catch {
    // Ignore release cache read failures and continue to live fetch.
  }

  // 3. Check for deduplication (if already fetching this album, join that request)
  const inFlight = releaseRequestsInFlight.get(releaseId)
  if (inFlight) return inFlight

  // 4. Create a fetch promise to share with other callers
  const fetchPromise = (async () => {
    // Extract the real Discogs ID and type from the prefixed ID
    const isMaster = releaseId.startsWith('m:')
    const isRelease = releaseId.startsWith('r:')
    const cleanId = isMaster || isRelease ? releaseId.slice(2) : releaseId

    const normalizeAndCache = (payload: any, fallbackTrackCount = 0) => {
      const normalized = normalizeRelease(payload, fallbackTrackCount)
      if (!normalized) throw new Error('Unable to normalize release')
      normalized.id = releaseId
      
      // Store in memory LRU
      releaseMemoryCache.set(releaseId, normalized)
      void upsertReleaseDetailsCache(normalized).catch(() => {
        // Ignore DB cache write failures.
      })
      return normalized
    }

    try {
      if (isMaster) {
        const master = await requestDiscogs(`/masters/${cleanId}`)
        const mainReleaseId = String(master?.main_release ?? '').trim()
        if (mainReleaseId) {
          try {
            const mainRelease = await requestDiscogs(`/releases/${mainReleaseId}`)
            return normalizeAndCache(mainRelease, mainRelease.tracklist?.length)
          } catch { /* fallback to master */ }
        }
        return normalizeAndCache({ ...master, id: master.id, title: master.title, tracklist: master.tracklist ?? [] })
      }

      const response = await requestDiscogs(`/releases/${cleanId}`)
      return normalizeAndCache(response, response.tracklist?.length)
    } catch (error) {
      if (isRelease) throw error
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('404') && !isMaster) throw error

      try {
        const master = await requestDiscogs(`/masters/${cleanId}`)
        const mainReleaseId = String(master?.main_release ?? '').trim()
        if (mainReleaseId) {
          const mainRelease = await requestDiscogs(`/releases/${mainReleaseId}`)
          return normalizeAndCache(mainRelease, mainRelease.tracklist?.length)
        }
        return normalizeAndCache({ ...master, id: master.id, title: master.title, tracklist: master.tracklist ?? [] })
      } catch {
        throw error
      }
    }
  })()

  // Register for deduplication
  releaseRequestsInFlight.set(releaseId, fetchPromise)

  try {
    const result = await fetchPromise
    return result
  } finally {
    // Cleanup flight map so future requests can happen if cache expires
    releaseRequestsInFlight.delete(releaseId)
  }
}
