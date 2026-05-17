import { validatedRequest, AlbumSchema } from './apiClient.js'
import { z } from 'zod'

const CACHE_WINDOW = 1000 * 60 * 60 // 1 hour
const FEATURED_CACHE_WINDOW = 1000 * 60 * 5 // 5 minutes
const DETAILS_CACHE_WINDOW = 1000 * 60 * 60 * 24 // 24 hours
const SEARCH_CACHE_VERSION = 'v5'

const featuredCache = { timestamp: 0, data: [] }
const recentPopularCache = { timestamp: 0, data: [] }
const homeSectionsCache = {
  timestamp: 0,
  data: {
    mostHappening: { data: [], error: null },
    recentReleases: { data: [], error: null },
  },
}
const SEARCH_CACHE_PREFIX = `musico:search:${SEARCH_CACHE_VERSION}:`
const RELEASE_CACHE_PREFIX = 'musico:release:'

const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key)
      if (!item) return null
      return JSON.parse(item)
    } catch {
      return null
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      // Track this cache key for faster updates later
      recentCacheKeys.add(key)
    } catch {
      // Ignore quota errors
    }
  },
}

// Track recently accessed cache keys to avoid iterating through entire localStorage
const recentCacheKeys = new Set()

const isFresh = (timestamp, ttl = CACHE_WINDOW) => Date.now() - timestamp < ttl

const AlbumArraySchema = z.array(AlbumSchema)

const patchAlbumStats = (album, albumId, communityRating, reviewCount) => {
  if (!album || String(album.id) !== String(albumId)) return album
  return {
    ...album,
    communityRating,
    reviewCount,
  }
}

const patchAlbumStatsInCollection = (albums, albumId, communityRating, reviewCount) => {
  if (!Array.isArray(albums) || !albums.length) return albums
  return albums.map((album) => patchAlbumStats(album, albumId, communityRating, reviewCount))
}

export const updateAlbumCommunityStatsInCache = ({ albumId, communityRating, reviewCount }) => {
  const normalizedAlbumId = String(albumId ?? '').trim()
  const normalizedRating = Number(communityRating)
  const normalizedCount = Number(reviewCount)

  if (!normalizedAlbumId) return
  if (!Number.isFinite(normalizedRating) || !Number.isFinite(normalizedCount)) return

  featuredCache.data = patchAlbumStatsInCollection(
    featuredCache.data,
    normalizedAlbumId,
    normalizedRating,
    normalizedCount,
  )
  recentPopularCache.data = patchAlbumStatsInCollection(
    recentPopularCache.data,
    normalizedAlbumId,
    normalizedRating,
    normalizedCount,
  )

  try {
    // Iterate through tracked cache keys instead of entire localStorage
    // This is O(n) where n = tracked keys, not O(localStorage.length)
    const keysToDelete = []
    
    for (const key of recentCacheKeys) {
      // Clean up deleted keys
      if (!localStorage.getItem(key)) {
        keysToDelete.push(key)
        continue
      }

      if (key === `${RELEASE_CACHE_PREFIX}${normalizedAlbumId}`) {
        const cachedRelease = storage.get(key)
        if (cachedRelease?.data) {
          storage.set(key, {
            ...cachedRelease,
            data: patchAlbumStats(cachedRelease.data, normalizedAlbumId, normalizedRating, normalizedCount),
          })
        }
        continue
      }

      if (!key.startsWith(SEARCH_CACHE_PREFIX)) continue

      const cachedSearch = storage.get(key)
      if (!cachedSearch?.data) continue

      storage.set(key, {
        ...cachedSearch,
        data: patchAlbumStatsInCollection(
          cachedSearch.data,
          normalizedAlbumId,
          normalizedRating,
          normalizedCount,
        ),
      })
    }
    
    // Clean up deleted keys from tracking set
    keysToDelete.forEach((key) => recentCacheKeys.delete(key))
  } catch {
    // Ignore storage access failures.
  }
}

export const getFeaturedReleases = async (limit = 24) => {
  if (featuredCache.data.length && isFresh(featuredCache.timestamp, FEATURED_CACHE_WINDOW)) {
    return featuredCache.data.slice(0, limit)
  }

  const response = await validatedRequest({ url: '/api/featured', params: { limit } })
  // Backend returns { data: [...] } which Axios interceptor resolves to response
  // Wait, if it's already intercepted, response is the data payload! Wait, no, the backend returns { data: array }.
  // So response is { data: array }.
  const data = Array.isArray(response?.data) ? response.data : []
  
  // Validate silently
  const result = AlbumArraySchema.safeParse(data)
  if (!result.success) {
    console.warn('[Validation Warning] Featured releases malformed:', result.error.format())
  }

  featuredCache.timestamp = Date.now()
  featuredCache.data = data
  return data.slice(0, limit)
}

export const getRecentPopularReleases = async (limit = 24) => {
  if (recentPopularCache.data.length && isFresh(recentPopularCache.timestamp, FEATURED_CACHE_WINDOW)) {
    return recentPopularCache.data.slice(0, limit)
  }

  const response = await validatedRequest({
    url: '/api/featured',
    params: {
      limit,
      mode: 'recent-popular',
    },
  })

  const data = Array.isArray(response?.data) ? response.data : []
  
  const result = AlbumArraySchema.safeParse(data)
  if (!result.success) {
    console.warn('[Validation Warning] Recent popular releases malformed:', result.error.format())
  }

  recentPopularCache.timestamp = Date.now()
  recentPopularCache.data = data
  return data.slice(0, limit)
}

export const getHomeSections = async (options = {}) => {
  const happeningLimit = Number.isFinite(options?.happeningLimit) ? options.happeningLimit : 24
  const recentLimit = Number.isFinite(options?.recentLimit) ? options.recentLimit : 24

  if (isFresh(homeSectionsCache.timestamp, FEATURED_CACHE_WINDOW)) {
    return {
      mostHappening: {
        data: homeSectionsCache.data.mostHappening.data.slice(0, happeningLimit),
        error: homeSectionsCache.data.mostHappening.error,
      },
      recentReleases: {
        data: homeSectionsCache.data.recentReleases.data.slice(0, recentLimit),
        error: homeSectionsCache.data.recentReleases.error,
      },
    }
  }

  const response = await validatedRequest({
    url: '/api/home',
    params: {
      happeningLimit,
      recentLimit,
    },
  })

  const mostHappeningData = Array.isArray(response?.mostHappening?.data) ? response.mostHappening.data : []
  const recentReleasesData = Array.isArray(response?.recentReleases?.data) ? response.recentReleases.data : []

  const mostHappeningResult = AlbumArraySchema.safeParse(mostHappeningData)
  if (!mostHappeningResult.success) {
    console.warn('[Validation Warning] Home most happening malformed:', mostHappeningResult.error.format())
  }

  const recentReleasesResult = AlbumArraySchema.safeParse(recentReleasesData)
  if (!recentReleasesResult.success) {
    console.warn('[Validation Warning] Home recent releases malformed:', recentReleasesResult.error.format())
  }

  featuredCache.timestamp = Date.now()
  featuredCache.data = mostHappeningData
  recentPopularCache.timestamp = Date.now()
  recentPopularCache.data = recentReleasesData
  homeSectionsCache.timestamp = Date.now()
  homeSectionsCache.data = {
    mostHappening: {
      data: mostHappeningData,
      error: response?.mostHappening?.error ?? null,
    },
    recentReleases: {
      data: recentReleasesData,
      error: response?.recentReleases?.error ?? null,
    },
  }

  return {
    mostHappening: {
      data: mostHappeningData.slice(0, happeningLimit),
      error: response?.mostHappening?.error ?? null,
    },
    recentReleases: {
      data: recentReleasesData.slice(0, recentLimit),
      error: response?.recentReleases?.error ?? null,
    },
  }
}

export const searchReleases = async (query, options = {}) => {
  const trimmed = query?.trim()
  if (!trimmed) return { data: [], correctedQuery: null, hasMore: false, nextOffset: null, total: 0 }

  const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Math.round(Number(options.limit))) : 12
  const offset = Number.isFinite(Number(options.offset)) ? Math.max(0, Math.round(Number(options.offset))) : 0
  const cacheKey = `musico:search:${SEARCH_CACHE_VERSION}:${trimmed.toLowerCase()}:${limit}:${offset}`
  const cached = storage.get(cacheKey)
  if (cached && isFresh(cached.timestamp, CACHE_WINDOW)) {
    return {
      data: cached.data,
      correctedQuery: cached.correctedQuery ?? null,
      hasMore: Boolean(cached.hasMore),
      nextOffset: cached.nextOffset ?? null,
      total: Number(cached.total ?? cached.data?.length ?? 0),
    }
  }

  const response = await validatedRequest({ 
    url: '/api/search', 
    params: { q: trimmed, limit, offset },
    signal: options.signal 
  })
  const data = Array.isArray(response?.data) ? response.data : []
  const correctedQuery = response?.correctedQuery ?? null
  const hasMore = Boolean(response?.hasMore)
  const nextOffset = Number.isFinite(Number(response?.nextOffset)) ? Number(response.nextOffset) : null
  const total = Number.isFinite(Number(response?.total)) ? Number(response.total) : data.length
  
  const result = AlbumArraySchema.safeParse(data)
  if (!result.success) {
    console.warn('[Validation Warning] Search results malformed:', result.error.format())
  }

  storage.set(cacheKey, { data, correctedQuery, hasMore, nextOffset, total, timestamp: Date.now() })
  return { data, correctedQuery, hasMore, nextOffset, total }
}

export const getReleaseDetails = async (releaseId) => {
  if (!releaseId) throw new Error('Release id missing')

  const cacheKey = `musico:release:${releaseId}`
  const cached = storage.get(cacheKey)
  if (cached && isFresh(cached.timestamp, DETAILS_CACHE_WINDOW)) {
    return cached.data
  }

  const data = await validatedRequest({ url: `/api/releases/${releaseId}` }, AlbumSchema)
  storage.set(cacheKey, { data, timestamp: Date.now() })
  return data
}

export const prefetchReleaseDetails = async (releaseId) => {
  try {
    await getReleaseDetails(releaseId)
  } catch {
    // ignore prefetch errors
  }
}
