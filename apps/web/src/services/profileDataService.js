import { requestPrivateJson } from './apiClient.js'

export const fetchMyRatings = async () => {
  const response = await requestPrivateJson('/api/me/ratings', {
    fallbackMessage: 'Unable to sync profile data right now.',
  })

  return response?.data && typeof response.data === 'object' ? response.data : {}
}

export const saveMyRating = async (albumId, rating, meta = {}) => {
  const payload = { rating }
  if (meta.albumName) payload.albumName = meta.albumName
  if (meta.albumCover) payload.albumCover = meta.albumCover

  const response = await requestPrivateJson(`/api/me/ratings/${encodeURIComponent(albumId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    fallbackMessage: 'Unable to save rating.',
  })

  return response?.data ?? { rating, timestamp: Date.now() }
}

export const fetchMyLists = async () => {
  const response = await requestPrivateJson('/api/me/lists', {
    fallbackMessage: 'Unable to load your lists.',
  })
  return Array.isArray(response?.data) ? response.data : []
}

export const createMyList = async (name) => {
  const response = await requestPrivateJson('/api/me/lists', {
    method: 'POST',
    body: JSON.stringify({ name }),
    fallbackMessage: 'Unable to create list.',
  })

  return response?.data ?? null
}

export const toggleAlbumInMyList = async (listId, album) => {
  const response = await requestPrivateJson(`/api/me/lists/${encodeURIComponent(listId)}/toggle`, {
    method: 'POST',
    body: JSON.stringify(album),
    fallbackMessage: 'Unable to update list.',
  })

  return response?.data ?? { added: false }
}
