const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const CACHE_WINDOW = 1000 * 60 * 60 // 1 hour
const FEATURED_CACHE_WINDOW = 1000 * 60 * 5 // 5 minutes

const featuredCache = { timestamp: 0, data: [] }
const recentPopularCache = { timestamp: 0, data: [] }
const searchCache = new Map()
const releaseCache = new Map()

const requestBackend = async (path, params = {}) => {
  const url = new URL(`${API_BASE_URL}${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  const response = await fetch(url.toString())
  if (!response.ok) {
    let message = 'Music data service is unavailable.'
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // ignore body parse errors
    }
    throw new Error(message)
  }

  return response.json()
}

const isFresh = (timestamp, ttl = CACHE_WINDOW) => Date.now() - timestamp < ttl

export const getFeaturedReleases = async (limit = 24, options = {}) => {
  const forceRefresh = Boolean(options?.forceRefresh)
  if (!forceRefresh && featuredCache.data.length && isFresh(featuredCache.timestamp, FEATURED_CACHE_WINDOW)) {
    return featuredCache.data.slice(0, limit)
  }

  const response = await requestBackend('/api/featured', { limit, refresh: forceRefresh ? 1 : undefined })
  const data = Array.isArray(response?.data) ? response.data : []
  featuredCache.timestamp = Date.now()
  featuredCache.data = data
  return data.slice(0, limit)
}

export const getRecentPopularReleases = async (limit = 24, options = {}) => {
  const forceRefresh = Boolean(options?.forceRefresh)
  if (!forceRefresh && recentPopularCache.data.length && isFresh(recentPopularCache.timestamp, FEATURED_CACHE_WINDOW)) {
    return recentPopularCache.data.slice(0, limit)
  }

  const response = await requestBackend('/api/featured', {
    limit,
    mode: 'recent-popular',
    refresh: forceRefresh ? 1 : undefined,
  })
  const data = Array.isArray(response?.data) ? response.data : []
  recentPopularCache.timestamp = Date.now()
  recentPopularCache.data = data
  return data.slice(0, limit)
}

export const searchReleases = async (query) => {
  const trimmed = query?.trim()
  if (!trimmed) return []
  const cacheKey = trimmed.toLowerCase()
  const cached = searchCache.get(cacheKey)
  if (cached && isFresh(cached.timestamp)) return cached.data

  const response = await requestBackend('/api/search', { q: trimmed })
  const data = Array.isArray(response?.data) ? response.data : []
  searchCache.set(cacheKey, { data, timestamp: Date.now() })
  return data
}

export const getReleaseDetails = async (releaseId) => {
  if (!releaseId) throw new Error('Release id missing')
  const cached = releaseCache.get(releaseId)
  if (cached && isFresh(cached.timestamp)) return cached.data

  const data = await requestBackend(`/api/releases/${releaseId}`)
  releaseCache.set(releaseId, { data, timestamp: Date.now() })
  return data
}

export const prefetchReleaseDetails = async (releaseId) => {
  try {
    await getReleaseDetails(releaseId)
  } catch {
    // ignore prefetch errors
  }
}
