import { createHash } from 'node:crypto'

import { eq } from 'drizzle-orm'

import type { ReleaseDetails, ReleaseSummary } from './types'

import { db } from './db'
import { env } from './env'
import { featuredCache as featuredCacheTable, searchCache as searchCacheTable } from './schema'

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

const RELEASE_CACHE_WINDOW = 1000 * 60 * 60 // 1 hour
const FEATURED_DB_CACHE_WINDOW = env.FEATURED_CACHE_TTL_MS
const SEARCH_DB_CACHE_WINDOW = env.SEARCH_CACHE_TTL_MS
const FEATURED_RETRY_COOLDOWN_MS = env.FEATURED_RETRY_COOLDOWN_MS
const SEARCH_RETRY_COOLDOWN_MS = env.SEARCH_RETRY_COOLDOWN_MS
const FEATURED_REFRESH_SIZE = 50
const FEATURED_DETAIL_HYDRATION_LIMIT = env.FEATURED_DETAIL_HYDRATION_LIMIT
const SEARCH_CACHE_VERSION = 'v8'
const SEARCH_RESULTS_PER_PAGE = 100
const SEARCH_MAX_PAGES = env.SEARCH_MAX_PAGES
const SEARCH_QUERY_PAGES = env.SEARCH_QUERY_PAGES
const SEARCH_MIN_RESULTS_BEFORE_PAGING = env.SEARCH_MIN_RESULTS_BEFORE_PAGING
const SEARCH_ARTIST_CANDIDATE_LIMIT = 5
const DISCOGS_MIN_REQUEST_INTERVAL_MS = env.DISCOGS_MIN_REQUEST_INTERVAL_MS
const DISCOGS_MAX_RETRIES = env.DISCOGS_MAX_RETRIES
const RELEASE_CACHE_MAX_ENTRIES = env.RELEASE_CACHE_MAX_ENTRIES

const releaseCache = new Map<string, { data: ReleaseDetails; timestamp: number }>()
const featuredRefreshInFlight = new Map<string, Promise<ReleaseSummary[]>>()
const searchRefreshInFlight = new Map<string, Promise<ReleaseSummary[]>>()
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

const requestDiscogs = async (endpoint: string, params: Record<string, string | number | undefined> = {}) => {
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
    await throttleDiscogs()
    let response = await fetch(makeUrl(false), { headers: makeHeaders(true) })

    // Some Discogs setups only accept user token via query param.
    if (response.status === 401 && DISCOGS_TOKEN) {
      await throttleDiscogs()
      response = await fetch(makeUrl(true), { headers: makeHeaders(false) })
    }

    // If token auth fails entirely and no key/secret exists, retry as anonymous public request.
    if (response.status === 401 && DISCOGS_TOKEN && !(DISCOGS_KEY && DISCOGS_SECRET)) {
      await throttleDiscogs()
      response = await fetch(makeUrl(false), { headers: makeHeaders(false) })
    }

    return response
  }

  for (let attempt = 0; attempt <= DISCOGS_MAX_RETRIES; attempt += 1) {
    const response = await fetchWithAuthFallback()
    if (response.ok) {
      return response.json()
    }

    const retryableStatus = response.status === 429 || response.status >= 500
    if (retryableStatus && attempt < DISCOGS_MAX_RETRIES) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'))
      await wait(Math.max(backoffMs(attempt), retryAfterMs ?? 0))
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
  
  const albumType = (release.albumType ?? '').toLowerCase()
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

const normalizeSearchValue = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
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
  // Use Discogs general search to find approximate artist/album name matches
  const response = await requestDiscogs('/database/search', {
    q: sourceQuery,
    per_page: 25,
    type: 'artist',
  })

  const results = Array.isArray(response?.results) ? response.results : []
  if (!results.length) return null

  let bestCandidate: string | null = null
  let bestScore = 0

  for (const entry of results) {
    const title = typeof entry?.title === 'string' ? stripDiscogsDisambiguation(entry.title) : ''
    if (!title) continue
    const score = fuzzyScore(sourceQuery, title)
    if (score > bestScore && score >= FUZZY_SIMILARITY_THRESHOLD) {
      bestScore = score
      bestCandidate = title
    }
  }

  return bestCandidate
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
    (!cachedNeedsRefresh || recentRefresh)
  ) {
    return cachedPayload.slice(0, safeLimit)
  }

  try {
    const refreshed = await refreshFeaturedMode(mode)
    return refreshed.slice(0, safeLimit)
  } catch {
    if (cachedPayload.length) {
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

const refreshSearchQuery = async (queryHash: string, normalizedQuery: string, sourceQuery: string) => {
  const existing = searchRefreshInFlight.get(queryHash)
  if (existing) return existing

  const refreshPromise = (async () => {
    const [artistScopedResults, queryResults] = await Promise.all([
      fetchAllSearchPages({
        artist: sourceQuery,
        type: 'master',
        format: 'album',
      }, SEARCH_MAX_PAGES),
      fetchAllSearchPages({
        q: sourceQuery,
        type: 'master',
        format: 'album',
      }, SEARCH_QUERY_PAGES),
    ])

    const normalized = mapDiscogsMasterSearchResults([...artistScopedResults, ...queryResults])
    const curated = dedupeReleasedAlbums(normalized).filter((release) => {
      const albumType = (release.albumType ?? '').toLowerCase()
      // Broaden filter to catch things labeled slightly differently but still likely albums
      return albumType.includes('album') || albumType.includes('lp') || albumType === 'release' || !albumType
    })

    const preferredArtists = [
      sourceQuery,
      ...artistScopedResults.map((entry: any) => extractMasterArtist(entry)).filter(Boolean),
      ...queryResults.map((entry: any) => extractMasterArtist(entry)).filter(Boolean),
    ]

    // Final sorting: Exact matches on query string (artist or album) get top priority
    const lowerQuery = sourceQuery.toLowerCase()
    const ordered = dedupeByReleaseId(sortReleasedAlbumsChronologically(curated, preferredArtists))
      .sort((a, b) => {
        const aName = (a.name ?? '').toLowerCase()
        const bName = (b.name ?? '').toLowerCase()
        const aArtist = (a.artists?.[0] ?? '').toLowerCase()
        const bArtist = (b.artists?.[0] ?? '').toLowerCase()

        const aExact = aName === lowerQuery || aArtist === lowerQuery
        const bExact = bName === lowerQuery || bArtist === lowerQuery

        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        // If both or neither are exact, use release quality score
        return releaseScore(b) - releaseScore(a)
      })

    await upsertSearchCache(queryHash, normalizedQuery, ordered)
    return ordered
  })()

  searchRefreshInFlight.set(queryHash, refreshPromise)
  return refreshPromise.finally(() => {
    searchRefreshInFlight.delete(queryHash)
  })
}

export interface SearchResult {
  data: ReleaseSummary[]
  correctedQuery?: string
}

export const searchReleases = async (query: string): Promise<SearchResult> => {
  const trimmed = query?.trim()
  if (!trimmed) return { data: [] }

  const normalizedQuery = normalizeCacheQuery(trimmed)
  const queryHash = createQueryHash(normalizedQuery)
  const cached = await getCachedSearch(queryHash)
  const cachedPayload = toReleaseSummaryArray(cached?.payload)
  const refreshedAt = cached?.refreshedAt?.getTime?.() ?? 0
  const recentRefresh = refreshedAt > 0 && Date.now() - refreshedAt < SEARCH_RETRY_COOLDOWN_MS

  if (
    cachedPayload.length &&
    isNotExpired(cached?.expiresAt) &&
    (!shouldRefreshSummaryPayload(cachedPayload) || recentRefresh)
  ) {
    return { data: cachedPayload }
  }

  try {
    const results = await refreshSearchQuery(queryHash, normalizedQuery, trimmed)

    // If the primary search returned results, return them directly
    if (results.length) return { data: results }

    // ─── Fuzzy fallback: try to find an approximate match ────────────
    const corrected = await fetchFuzzySuggestions(trimmed)
    if (corrected && normalizeSearchValue(corrected) !== normalizeSearchValue(trimmed)) {
      const correctedNorm = normalizeCacheQuery(corrected)
      const correctedHash = createQueryHash(correctedNorm)

      // Check if corrected query is already cached
      const correctedCached = await getCachedSearch(correctedHash)
      const correctedPayload = toReleaseSummaryArray(correctedCached?.payload)
      if (
        correctedPayload.length &&
        isNotExpired(correctedCached?.expiresAt) &&
        (!shouldRefreshSummaryPayload(correctedPayload) || recentRefresh)
      ) {
        return { data: correctedPayload, correctedQuery: corrected }
      }

      const correctedResults = await refreshSearchQuery(correctedHash, correctedNorm, corrected)
      if (correctedResults.length) {
        return { data: correctedResults, correctedQuery: corrected }
      }
    }

    return { data: results }
  } catch {
    if (cachedPayload.length) return { data: cachedPayload }
    throw new Error('Search unavailable right now. Please try again shortly.')
  }
}

export const getReleaseDetails = async (releaseId: string) => {
  if (!releaseId) throw new Error('Release id missing')
  const cached = releaseCache.get(releaseId)
  if (cached && isFresh(cached.timestamp)) return cached.data

  // Extract the real Discogs ID and type from the prefixed ID
  const isMaster = releaseId.startsWith('m:')
  const isRelease = releaseId.startsWith('r:')
  const cleanId = isMaster || isRelease ? releaseId.slice(2) : releaseId

  const normalizeAndCache = (payload: any, fallbackTrackCount = 0) => {
    const normalized = normalizeRelease(payload, fallbackTrackCount)
    if (!normalized) throw new Error('Unable to normalize release')
    // Keep the prefixed ID in the cached object for consistency
    normalized.id = releaseId
    setBoundedCacheEntry(releaseCache, releaseId, { data: normalized, timestamp: Date.now() }, RELEASE_CACHE_MAX_ENTRIES)
    return normalized
  }

  try {
    // If we KNOW it's a master, go straight to masters endpoint
    if (isMaster) {
      const master = await requestDiscogs(`/masters/${cleanId}`)
      const mainReleaseId = String(master?.main_release ?? '').trim()
      
      if (mainReleaseId) {
        try {
          const mainRelease = await requestDiscogs(`/releases/${mainReleaseId}`)
          return normalizeAndCache(mainRelease, mainRelease.tracklist?.length)
        } catch {
          // fallback to master payload if main release fetch fails
        }
      }

      return normalizeAndCache({
        ...master,
        id: master.id,
        title: master.title,
        tracklist: master.tracklist ?? [],
      })
    }

    // Otherwise (isRelease or unprefixed), try releases endpoint first
    const response = await requestDiscogs(`/releases/${cleanId}`)
    return normalizeAndCache(response, response.tracklist?.length)
  } catch (error) {
    // Fallback logic for unprefixed IDs or failed release fetches
    if (isRelease) throw error // If we specifically asked for a release and it failed, stop.

    const message = error instanceof Error ? error.message : ''
    const isNotFound = message.includes('Discogs request failed: 404')
    if (!isNotFound && !isMaster) throw error

    try {
      const master = await requestDiscogs(`/masters/${cleanId}`)
      const mainReleaseId = String(master?.main_release ?? '').trim()
      if (mainReleaseId) {
        const mainRelease = await requestDiscogs(`/releases/${mainReleaseId}`)
        return normalizeAndCache(mainRelease, mainRelease.tracklist?.length)
      }
      
      return normalizeAndCache({
        ...master,
        id: master.id,
        title: master.title,
        tracklist: master.tracklist ?? [],
      })
    } catch {
      throw error
    }
  }
}
