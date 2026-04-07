import { validatedRequest, AlbumSchema } from './apiClient.js'
import { z } from 'zod'

const CACHE_WINDOW = 1000 * 60 * 60 // 1 hour
const FEATURED_CACHE_WINDOW = 1000 * 60 * 5 // 5 minutes
const DETAILS_CACHE_WINDOW = 1000 * 60 * 60 * 24 // 24 hours
const SEARCH_CACHE_VERSION = 'v4'

const featuredCache = { timestamp: 0, data: [] }
const recentPopularCache = { timestamp: 0, data: [] }

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
    } catch {
      // Ignore quota errors
    }
  },
}

const isFresh = (timestamp, ttl = CACHE_WINDOW) => Date.now() - timestamp < ttl

const AlbumArraySchema = z.array(AlbumSchema)

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

export const searchReleases = async (query, options = {}) => {
  const trimmed = query?.trim()
  if (!trimmed) return { data: [], correctedQuery: null }

  const cacheKey = `musico:search:${SEARCH_CACHE_VERSION}:${trimmed.toLowerCase()}`
  const cached = storage.get(cacheKey)
  if (cached && isFresh(cached.timestamp, CACHE_WINDOW)) {
    return { data: cached.data, correctedQuery: cached.correctedQuery ?? null }
  }

  const response = await validatedRequest({ 
    url: '/api/search', 
    params: { q: trimmed },
    signal: options.signal 
  })
  const data = Array.isArray(response?.data) ? response.data : []
  const correctedQuery = response?.correctedQuery ?? null
  
  const result = AlbumArraySchema.safeParse(data)
  if (!result.success) {
    console.warn('[Validation Warning] Search results malformed:', result.error.format())
  }

  storage.set(cacheKey, { data, correctedQuery, timestamp: Date.now() })
  return { data, correctedQuery }
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
