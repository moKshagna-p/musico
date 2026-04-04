import { requestPublicJson } from './apiClient.js'

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

export const getFeaturedReleases = async (limit = 24) => {
  if (featuredCache.data.length && isFresh(featuredCache.timestamp, FEATURED_CACHE_WINDOW)) {
    return featuredCache.data.slice(0, limit)
  }

  const response = await requestPublicJson('/api/featured', {
    params: { limit },
    fallbackMessage: 'Music data service is unavailable.',
  })

  const data = Array.isArray(response?.data) ? response.data : []
  featuredCache.timestamp = Date.now()
  featuredCache.data = data
  return data.slice(0, limit)
}

export const getRecentPopularReleases = async (limit = 24) => {
  if (recentPopularCache.data.length && isFresh(recentPopularCache.timestamp, FEATURED_CACHE_WINDOW)) {
    return recentPopularCache.data.slice(0, limit)
  }

  const response = await requestPublicJson('/api/featured', {
    params: {
      limit,
      mode: 'recent-popular',
    },
    fallbackMessage: 'Music data service is unavailable.',
  })

  const data = Array.isArray(response?.data) ? response.data : []
  recentPopularCache.timestamp = Date.now()
  recentPopularCache.data = data
  return data.slice(0, limit)
}

export const searchReleases = async (query) => {
  const trimmed = query?.trim()
  if (!trimmed) return { data: [], correctedQuery: null }

  const cacheKey = `musico:search:${SEARCH_CACHE_VERSION}:${trimmed.toLowerCase()}`
  const cached = storage.get(cacheKey)
  if (cached && isFresh(cached.timestamp, CACHE_WINDOW)) {
    return { data: cached.data, correctedQuery: cached.correctedQuery ?? null }
  }

  const response = await requestPublicJson('/api/search', {
    params: { q: trimmed },
    fallbackMessage: 'Music data service is unavailable.',
  })

  const data = Array.isArray(response?.data) ? response.data : []
  const correctedQuery = response?.correctedQuery ?? null
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

  const data = await requestPublicJson(`/api/releases/${releaseId}`, {
    fallbackMessage: 'Music data service is unavailable.',
  })

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
