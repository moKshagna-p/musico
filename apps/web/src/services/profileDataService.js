import api from './apiClient.js'

/**
 * Professional Profile Data Service using Axios apiClient
 */

export const fetchMyRatings = async () => {
  const response = await api.get('/api/me/ratings')
  // Axios interceptor returns response.data directly
  return response.data && typeof response.data === 'object' ? response.data : {}
}

export const saveMyRating = async (albumId, rating, meta = {}) => {
  const payload = { rating }
  if (meta.albumName) payload.albumName = meta.albumName
  if (meta.albumCover) payload.albumCover = meta.albumCover

  const response = await api.put(`/api/me/ratings/${encodeURIComponent(albumId)}`, payload)
  return response.data ?? { rating, timestamp: Date.now() }
}

export const fetchMyLists = async () => {
  const response = await api.get('/api/me/lists')
  return Array.isArray(response.data) ? response.data : []
}

export const createMyList = async (name) => {
  const response = await api.post('/api/me/lists', { name })
  return response.data ?? null
}

export const toggleAlbumInMyList = async (listId, album) => {
  const response = await api.post(`/api/me/lists/${encodeURIComponent(listId)}/toggle`, album)
  return response.data ?? { added: false }
}
