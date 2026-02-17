import { createHash } from 'node:crypto'

import { eq } from 'drizzle-orm'

import type { Release } from './types'

import { db } from './db'
import { featuredCache as featuredCacheTable, searchCache as searchCacheTable } from './schema'

const env = ((globalThis as unknown as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env ??
  process.env ??
  {}) as Record<string, string | undefined>

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
const DISCOGS_USER_AGENT = env.DISCOGS_USER_AGENT?.trim() || 'musico/1.0 (+http://localhost:4000)'

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const RELEASE_CACHE_WINDOW = 1000 * 60 * 60 // 1 hour
const FEATURED_DB_CACHE_WINDOW = parsePositiveInteger(env.FEATURED_CACHE_TTL_MS, 1000 * 60 * 60 * 24)
const SEARCH_DB_CACHE_WINDOW = parsePositiveInteger(env.SEARCH_CACHE_TTL_MS, 1000 * 60 * 60 * 24 * 7)
const FEATURED_REFRESH_SIZE = 50
const SEARCH_CACHE_VERSION = 'v4'
const SEARCH_RESULTS_PER_PAGE = 100
const SEARCH_MAX_PAGES = 8
const SEARCH_QUERY_PAGES = 4
const SEARCH_ARTIST_CANDIDATE_LIMIT = 3

const releaseCache = new Map<string, { data: Release; timestamp: number }>()
const featuredRefreshInFlight = new Map<string, Promise<Release[]>>()
const searchRefreshInFlight = new Map<string, Promise<Release[]>>()

const HEADERS: Record<string, string> = {
  'User-Agent': DISCOGS_USER_AGENT,
  Accept: 'application/json',
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

const normalizeRelease = (release: any, fallbackTrackCount = 0): Release | null => {
  if (!release) return null
  const artists =
    parseArtists(release.artists, release.title) ||
    parseArtists(release.extraartists, release.title) ||
    parseArtists(release.artist, release.title) ||
    parseArtists(release.title, release.title)

  const tracklist =
    release.tracklist?.map((track: any, index: number) => ({
      id: `${release.id}-${track.position ?? index}`,
      name: track.title ?? `Track ${index + 1}`,
      duration_ms: convertDurationToMs(track.duration),
      track_number: Number(track.position?.replace(/[^\d]/g, '')) || index + 1,
    })) ?? []

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

const requestDiscogs = async (endpoint: string, params: Record<string, string | number | undefined> = {}) => {
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

  let response = await fetch(makeUrl(false), { headers: makeHeaders(true) })

  // Some Discogs setups only accept user token via query param.
  if (response.status === 401 && DISCOGS_TOKEN) {
    response = await fetch(makeUrl(true), { headers: makeHeaders(false) })
  }

  // If token auth fails entirely and no key/secret exists, retry as anonymous public request.
  if (response.status === 401 && DISCOGS_TOKEN && !(DISCOGS_KEY && DISCOGS_SECRET)) {
    response = await fetch(makeUrl(false), { headers: makeHeaders(false) })
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    const hasCredentials = Boolean(DISCOGS_TOKEN || (DISCOGS_KEY && DISCOGS_SECRET))
    const reason = errorBody ? ` - ${errorBody.slice(0, 200)}` : ''
    throw new Error(`Discogs request failed: ${response.status}${hasCredentials ? ' (with credentials)' : ''}${reason}`)
  }
  return response.json()
}

const isFresh = (timestamp: number, ttl = RELEASE_CACHE_WINDOW) => Date.now() - timestamp < ttl
const isNotExpired = (expiresAt: Date | null | undefined) => Boolean(expiresAt && expiresAt.getTime() > Date.now())
const normalizeCacheQuery = (query: string) => query.trim().toLowerCase().replace(/\s+/g, ' ')
const createQueryHash = (query: string) => createHash('sha256').update(`${SEARCH_CACHE_VERSION}:${query}`).digest('hex')

const toReleaseArray = (value: unknown): Release[] => {
  if (!Array.isArray(value)) return []
  return value.filter(Boolean) as Release[]
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

const cleanAlbumName = (release: Release) => {
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

const isReleasedAlbum = (release: Release) => {
  const hasReleaseDate = Boolean(release.releaseYear || (release.releaseDate && release.releaseDate !== '0'))
  if (!hasReleaseDate) return false
  const currentYear = new Date().getFullYear()
  if (Number(release.releaseYear ?? 0) > currentYear) return false
  const albumType = release.albumType?.toLowerCase?.() ?? ''
  if (bannedAlbumTypes.some((item) => albumType.includes(item))) return false
  return true
}

const releaseScore = (release: Release) => {
  let score = 0
  if (release.releaseYear) score += 4
  if (release.cover) score += 2
  if ((release.reviewCount ?? 0) > 0) score += 1
  if (/album|lp/i.test(release.albumType ?? '')) score += 2
  if (/single|ep/i.test(release.albumType ?? '')) score -= 2
  if (hasVariantMarker(release.name)) score -= 3
  return score
}

const dedupeReleasedAlbums = (releases: Release[]) => {
  const picked = new Map<string, Release>()
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

const sortReleasedAlbumsChronologically = (releases: Release[], preferredArtists: string[] = []) => {
  const preferred = preferredArtists.map((artist) => normalizeCacheQuery(artist))
  const getArtistRank = (release: Release) => {
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

const mapDiscogsSearchResults = (results: any[]): Release[] =>
  results
    .map((entry: any) =>
      normalizeRelease({
        id: entry.id,
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
      }),
    )
    .filter(Boolean) as Release[]

const mapDiscogsMasterSearchResults = (results: any[]): Release[] =>
  results
    .map((entry: any) => {
      const id = entry.main_release ?? entry.id
      if (!id) return null
      const formatName = Array.isArray(entry.format)
        ? entry.format.filter(Boolean).map(String).join(' / ')
        : String(entry.format ?? '').trim()
      const labelName = Array.isArray(entry.label)
        ? String(entry.label[0] ?? '').trim()
        : String(entry.label ?? '').trim()
      const year = Number(entry.year)
      return normalizeRelease({
        id,
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
    })
    .filter(Boolean) as Release[]

const normalizeSearchValue = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

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
) => {
  const firstPage = await requestDiscogs('/database/search', {
    ...params,
    per_page: SEARCH_RESULTS_PER_PAGE,
    page: 1,
  })
  const totalPages = Math.max(
    1,
    Math.min(Number(firstPage?.pagination?.pages ?? 1) || 1, Math.max(1, maxPages)),
  )
  const nextPageRequests =
    totalPages > 1
      ? Array.from({ length: totalPages - 1 }, (_, index) =>
          requestDiscogs('/database/search', {
            ...params,
            per_page: SEARCH_RESULTS_PER_PAGE,
            page: index + 2,
          }),
        )
      : []
  const nextPages = nextPageRequests.length ? await Promise.all(nextPageRequests) : []
  return [firstPage, ...nextPages].flatMap((page) => (Array.isArray(page?.results) ? page.results : []))
}

type FeaturedMode = 'featured' | 'recent-popular'

const clampLimit = (value: number, fallback = 24) => {
  const safe = Number.isFinite(value) ? value : fallback
  return Math.min(Math.max(Math.round(safe), 1), FEATURED_REFRESH_SIZE)
}

const getCachedFeatured = async (mode: FeaturedMode) => {
  const rows = await db.select().from(featuredCacheTable).where(eq(featuredCacheTable.mode, mode)).limit(1)
  return rows[0]
}

const upsertFeatured = async (mode: FeaturedMode, payload: Release[]) => {
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

const fetchFeaturedFromDiscogs = async (targetSize = FEATURED_REFRESH_SIZE) => {
  const response = await requestDiscogs('/database/search', {
    per_page: Math.max(targetSize * 2, 36),
    type: 'release',
    format: 'album',
    sort: 'have',
    sort_order: 'desc',
  })

  const normalized = mapDiscogsSearchResults(response.results ?? [])
  const curated = dedupeReleasedAlbums(normalized)
  return curated.slice(0, targetSize)
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
  return ranked.slice(0, targetSize)
}

const refreshFeaturedMode = async (mode: FeaturedMode) => {
  const existing = featuredRefreshInFlight.get(mode)
  if (existing) return existing

  const refreshPromise = (async () => {
    const payload =
      mode === 'recent-popular'
        ? await fetchRecentPopularFromDiscogs(FEATURED_REFRESH_SIZE)
        : await fetchFeaturedFromDiscogs(FEATURED_REFRESH_SIZE)
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
  const cachedPayload = toReleaseArray(cached?.payload)

  if (!forceRefresh && cachedPayload.length && isNotExpired(cached?.expiresAt)) {
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

const upsertSearchCache = async (queryHash: string, normalizedQuery: string, payload: Release[]) => {
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

    const inferredArtists = inferArtistCandidates([...artistScopedResults, ...queryResults], sourceQuery)
    const supplementalArtistResults = (
      await Promise.all(
        inferredArtists
          .filter((artist) => normalizeCacheQuery(artist) !== normalizeCacheQuery(sourceQuery))
          .map((artist) =>
            fetchAllSearchPages(
              {
                artist,
                type: 'master',
                format: 'album',
              },
              SEARCH_QUERY_PAGES,
            ),
          ),
      )
    ).flat()

    const normalized = mapDiscogsMasterSearchResults([...artistScopedResults, ...queryResults, ...supplementalArtistResults])
    const curated = dedupeReleasedAlbums(normalized).filter((release) => {
      const albumType = (release.albumType ?? '').toLowerCase()
      return albumType.includes('album') || albumType.includes('lp')
    })
    const preferredArtists = [
      sourceQuery,
      ...inferredArtists,
      ...queryResults.map((entry: any) => extractMasterArtist(entry)).filter(Boolean),
    ]
    const ordered = sortReleasedAlbumsChronologically(curated, preferredArtists)
    await upsertSearchCache(queryHash, normalizedQuery, ordered)
    return ordered
  })()

  searchRefreshInFlight.set(queryHash, refreshPromise)
  return refreshPromise.finally(() => {
    searchRefreshInFlight.delete(queryHash)
  })
}

export const searchReleases = async (query: string) => {
  const trimmed = query?.trim()
  if (!trimmed) return []

  const normalizedQuery = normalizeCacheQuery(trimmed)
  const queryHash = createQueryHash(normalizedQuery)
  const cached = await getCachedSearch(queryHash)
  const cachedPayload = toReleaseArray(cached?.payload)

  if (cachedPayload.length && isNotExpired(cached?.expiresAt)) {
    return cachedPayload
  }

  try {
    return await refreshSearchQuery(queryHash, normalizedQuery, trimmed)
  } catch {
    if (cachedPayload.length) return cachedPayload
    throw new Error('Search unavailable right now. Please try again shortly.')
  }
}

export const getReleaseDetails = async (releaseId: string) => {
  if (!releaseId) throw new Error('Release id missing')
  const cached = releaseCache.get(releaseId)
  if (cached && isFresh(cached.timestamp)) return cached.data

  const response = await requestDiscogs(`/releases/${releaseId}`)
  const normalized = normalizeRelease(response, response.tracklist?.length)
  if (!normalized) throw new Error('Unable to normalize release')

  releaseCache.set(releaseId, { data: normalized, timestamp: Date.now() })
  return normalized
}
