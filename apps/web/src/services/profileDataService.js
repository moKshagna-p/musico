import api from './apiClient.js'

/**
 * Professional Profile Data Service using Axios apiClient
 */

export const fetchMyRatings = async () => {
  const response = await api.get('/api/me/ratings')
  // Axios interceptor returns response.data directly
  return response.data && typeof response.data === 'object' ? response.data : {}
}

export const fetchMyRatingsHistory = async ({ limit = 20, cursor } = {}) => {
  const params = { limit }
  if (cursor) params.cursor = cursor

  const response = await api.get('/api/me/ratings/history', { params })
  return {
    items: Array.isArray(response.data) ? response.data : [],
    nextCursor: response.nextCursor ?? null,
  }
}

export const saveMyRating = async (albumId, rating, meta = {}) => {
  const payload = { rating }
  if (meta.albumName) payload.albumName = meta.albumName
  if (meta.albumCover) payload.albumCover = meta.albumCover

  const response = await api.put(`/api/me/ratings/${encodeURIComponent(albumId)}`, payload)
  return response.data ?? { rating, timestamp: Date.now() }
}

export const deleteMyRating = async (albumId) => {
  const response = await api.delete(`/api/me/ratings/${encodeURIComponent(albumId)}`)
  return response.data ?? { rating: null, timestamp: Date.now() }
}

export const fetchMyLists = async () => {
  const response = await api.get('/api/me/lists')
  return Array.isArray(response.data) ? response.data : []
}

export const createMyList = async (name, album) => {
  const payload = album ? { name, album } : { name }
  const response = await api.post('/api/me/lists', payload)
  return response.data ?? null
}

export const toggleAlbumInMyList = async (listId, album) => {
  const response = await api.post(`/api/me/lists/${encodeURIComponent(listId)}/toggle`, album)
  return response.data ?? { added: false }
}
