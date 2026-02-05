import { inferAlbumGenres } from '../utils/helpers.js'
import { generateCommunitySnapshot } from './ratingsService.js'

const DISCOGS_BASE = 'https://api.discogs.com'
const DISCOGS_TOKEN = import.meta.env.VITE_DISCOGS_TOKEN
const DISCOGS_KEY = import.meta.env.VITE_DISCOGS_KEY
const DISCOGS_SECRET = import.meta.env.VITE_DISCOGS_SECRET
const CACHE_WINDOW = 1000 * 60 * 5
const featuredCache = { timestamp: 0, data: [] }
const searchCache = new Map()
const releaseCache = new Map()

const HEADERS = {
  'User-Agent': 'MuseVault/1.0 (https://example.com)',
  Accept: 'application/json',
}

const convertDurationToMs = (duration) => {
  if (!duration || typeof duration !== 'string') return 0
  const cleaned = duration.trim()
  const colonValue = cleaned.includes(':') ? cleaned : cleaned.replace('.', ':')

  if (colonValue.includes(':')) {
    const [minPart, secPart] = colonValue.split(':')
    const minutes = Number(minPart.replace(/[^\d]/g, ''))
    const seconds = Number(secPart.replace(/[^\d]/g, '').slice(0, 2))
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return 0
    return minutes * 60000 + seconds * 1000
  }

  const numeric = Number(cleaned.replace(/[^\d.]/g, ''))
  if (!Number.isNaN(numeric)) {
    return Math.round(numeric * 60000)
  }

  return 0
}

const parseArtists = (input, title = '') => {
  if (!input) {
    // Try to extract artist from title if format is "Artist - Album"
    if (title && typeof title === 'string' && title.includes(' - ')) {
      return [title.split(' - ')[0].trim()]
    }
    return []
  }
  if (Array.isArray(input)) {
    return input
      .map((artist) => artist?.name ?? artist?.title ?? '')
      .filter(Boolean)
      .map((name) => name.replace(/\(\d+\)$/g, '').trim())
  }
  if (typeof input === 'string') {
    if (input.includes(' - ')) return [input.split(' - ')[0].trim()]
    return [input.trim()]
  }
  return []
}

const normalizeRelease = (release, fallbackTrackCount = 0) => {
  if (!release) return null
  const artists =
    parseArtists(release.artists, release.title) ||
    parseArtists(release.extraartists, release.title) ||
    parseArtists(release.artist, release.title) ||
    parseArtists(release.title, release.title)

  const tracklist =
    release.tracklist?.map((track, index) => ({
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
    genres: release.genres?.length
      ? release.genres
      : inferAlbumGenres({ id: release.id, name: release.title ?? release.name }),
    communityRating: ratingData.average ?? fallbackCommunity.average,
    reviewCount: ratingData.count ?? fallbackCommunity.total,
    tracks: tracklist,
  }
}

const requestDiscogs = async (endpoint, params = {}) => {
  const url = new URL(`${DISCOGS_BASE}${endpoint}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value)
    }
  })

  if (DISCOGS_KEY && DISCOGS_SECRET) {
    url.searchParams.append('key', DISCOGS_KEY)
    url.searchParams.append('secret', DISCOGS_SECRET)
  }

  const headers = { ...HEADERS }
  if (DISCOGS_TOKEN) {
    headers.Authorization = `Discogs token=${DISCOGS_TOKEN}`
  }

  const response = await fetch(url.toString(), {
    headers,
  })

  if (!response.ok) throw new Error(`Discogs request failed: ${response.status}`)
  const json = await response.json()
  console.log(json)
  return json
}

const decorateResults = (results = []) => {
  const seen = new Set()
  return results
    .map((entry) =>
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
    .filter((item) => {
      if (!item || !item.id) return false
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
}

export const getFeaturedReleases = async (limit = 24) => {
  const now = Date.now()
  if (featuredCache.data.length && now - featuredCache.timestamp < CACHE_WINDOW) {
    return featuredCache.data.slice(0, limit)
  }

  const response = await requestDiscogs('/database/search', {
    per_page: limit,
    type: 'release',
    sort: 'year',
    sort_order: 'desc',
  })
  const normalized = decorateResults(response.results)
  featuredCache.timestamp = now
  featuredCache.data = normalized
  return normalized
}

export const searchReleases = async (query) => {
  const trimmed = query?.trim()
  if (!trimmed) return []
  const cacheKey = trimmed.toLowerCase()
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_WINDOW) {
    return cached.data
  }

  const response = await requestDiscogs('/database/search', {
    q: trimmed,
    artist: trimmed,
    type: 'release',
    per_page: 30,
  })
  const normalized = decorateResults(response.results)
  searchCache.set(cacheKey, { data: normalized, timestamp: Date.now() })
  return normalized
}

export const getReleaseDetails = async (releaseId) => {
  if (!releaseId) throw new Error('Release id missing')
  if (releaseCache.has(releaseId)) return releaseCache.get(releaseId)

  const response = await requestDiscogs(`/releases/${releaseId}`)
  const normalized = normalizeRelease(response, response.tracklist?.length)
  releaseCache.set(releaseId, normalized)
  return normalized
}

export const prefetchReleaseDetails = async (releaseId) => {
  try {
    await getReleaseDetails(releaseId)
  } catch {
    // ignore prefetch errors
  }
}
