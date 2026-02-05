import type { Release } from './types'

const env = ((globalThis as unknown as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env ??
  process.env ??
  {}) as Record<string, string | undefined>

const DISCOGS_BASE = 'https://api.discogs.com'
const DISCOGS_TOKEN = env.DISCOGS_TOKEN
const DISCOGS_KEY = env.DISCOGS_KEY
const DISCOGS_SECRET = env.DISCOGS_SECRET

const CACHE_WINDOW = 1000 * 60 * 60 // 1 hour

const featuredCache: { data: Release[]; timestamp: number } = { data: [], timestamp: 0 }
const searchCache = new Map<string, { data: Release[]; timestamp: number }>()
const releaseCache = new Map<string, { data: Release; timestamp: number }>()

const HEADERS: Record<string, string> = {
  'User-Agent': 'MuseVault/1.0 (https://example.com)',
  Accept: 'application/json',
}

const baseGenres = [
  'Neo-Soul',
  'Jazztronica',
  'Alt R&B',
  'Analog House',
  'Indie Electronic',
  'Future Funk',
  'Atmospheric Pop',
  'Chillwave',
]

const seedFromString = (value = '') =>
  String(value)
    .split('')
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 997, 7)

const inferGenresFromSeed = (album?: { id?: string; name?: string; album_type?: string; total_tracks?: number }) => {
  const list = new Set<string>()
  const seed = seedFromString(album?.id ?? album?.name ?? '')
  const first = baseGenres[seed % baseGenres.length]
  const second = baseGenres[(seed * 3) % baseGenres.length]
  list.add(first)
  if (second !== first) list.add(second)
  if (album?.album_type === 'single') list.add('Collector Cut')
  if ((album?.total_tracks ?? 0) > 16) list.add('Extended Edition')
  return Array.from(list)
}

const inferAlbumGenres = (album: Partial<Release>) => {
  if (album?.genres?.length) return album.genres
  return inferGenresFromSeed(album)
}

const generateCommunitySnapshot = (album?: { id?: string; name?: string; popularity?: number }, userRating?: number) => {
  const popularity = album?.popularity ?? 52
  const seed = seedFromString(album?.id ?? album?.name ?? '')
  const baseRating = 3.2 + (popularity / 100) * 1.4 + ((seed % 20) / 100)
  const rating = Math.min(5, Math.max(1.2, baseRating + (userRating ? userRating / 50 : 0)))
  const total = 120 + Math.round(popularity * 6) + (seed % 90)

  return {
    average: Number(rating.toFixed(1)),
    total,
  }
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

const parseArtists = (input: unknown, title = ''): string[] => {
  if (!input) {
    if (title && typeof title === 'string' && title.includes(' - ')) return [title.split(' - ')[0].trim()]
    return []
  }
  if (Array.isArray(input)) {
    return input
      .map((artist) => (artist as { name?: string; title?: string })?.name ?? artist?.title ?? '')
      .filter(Boolean)
      .map((name) => name.replace(/\(\d+\)$/g, '').trim())
  }
  if (typeof input === 'string') {
    if (input.includes(' - ')) return [input.split(' - ')[0].trim()]
    return [input.trim()]
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

  const fallbackCommunity = generateCommunitySnapshot(release)
  const ratingData = release.community?.rating ?? {}

  return {
    id: release.id?.toString(),
    name: release.title ?? release.name ?? 'Untitled',
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
    genres: inferAlbumGenres({ ...release, tracks: tracklist }) ?? [],
    communityRating: ratingData.average ?? fallbackCommunity.average,
    reviewCount: ratingData.count ?? fallbackCommunity.total,
    tracks: tracklist,
  }
}

const requestDiscogs = async (endpoint: string, params: Record<string, string | number | undefined> = {}) => {
  const url = new URL(`${DISCOGS_BASE}${endpoint}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.append(key, String(value))
  })

  if (DISCOGS_KEY && DISCOGS_SECRET) {
    url.searchParams.append('key', DISCOGS_KEY)
    url.searchParams.append('secret', DISCOGS_SECRET)
  }

  const headers = { ...HEADERS }
  if (DISCOGS_TOKEN) headers.Authorization = `Discogs token=${DISCOGS_TOKEN}`

  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`Discogs request failed: ${response.status}`)
  return response.json()
}

const isFresh = (timestamp: number) => Date.now() - timestamp < CACHE_WINDOW

export const getFeaturedReleases = async (limit = 24) => {
  if (featuredCache.data.length && isFresh(featuredCache.timestamp)) {
    return featuredCache.data.slice(0, limit)
  }
  const response = await requestDiscogs('/database/search', {
    per_page: limit,
    type: 'release',
    sort: 'year',
    sort_order: 'desc',
  })
  const normalized = (response.results ?? [])
    .map((entry: any) =>
      normalizeRelease({
        id: entry.id,
        title: entry.title,
        artist: entry.artist,
        year: entry.year,
        cover_image: entry.cover_image,
        thumb: entry.thumb,
        genres: entry.genre,
        labels: entry.label ? [{ name: entry.label }] : undefined,
        formats: entry.format ? [{ name: entry.format }] : undefined,
        uri: entry.uri,
        community: entry.community,
      }),
    )
    .filter(Boolean) as Release[]

  featuredCache.data = normalized
  featuredCache.timestamp = Date.now()
  return normalized.slice(0, limit)
}

export const searchReleases = async (query: string) => {
  const trimmed = query?.trim()
  if (!trimmed) return []
  const cacheKey = trimmed.toLowerCase()
  const cached = searchCache.get(cacheKey)
  if (cached && isFresh(cached.timestamp)) return cached.data

  const response = await requestDiscogs('/database/search', {
    q: trimmed,
    type: 'release',
    per_page: 30,
  })
  const normalized = (response.results ?? [])
    .map((entry: any) =>
      normalizeRelease({
        id: entry.id,
        title: entry.title,
        artist: entry.artist,
        year: entry.year,
        cover_image: entry.cover_image,
        thumb: entry.thumb,
        genres: entry.genre,
        labels: entry.label ? [{ name: entry.label }] : undefined,
        formats: entry.format ? [{ name: entry.format }] : undefined,
        uri: entry.uri,
        community: entry.community,
      }),
    )
    .filter(Boolean) as Release[]

  searchCache.set(cacheKey, { data: normalized, timestamp: Date.now() })
  return normalized
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
