import api from './apiClient.js'

export const updateMyProfile = async ({ username, bio, image, cover }) => {
  const payload = {}
  if (username !== undefined) payload.username = username
  if (bio !== undefined) payload.bio = bio
  if (image !== undefined) payload.image = image
  if (cover !== undefined) payload.cover = cover

  const response = await api.put('/api/me/profile', payload)
  return response.data ?? null
}

export const checkUsernameAvailability = async (username, { signal } = {}) => {
  const response = await api.get('/api/username/check', { params: { username }, signal })
  if (!response.data) throw new Error('Unable to check username.')
  return response.data
}

export const fetchUserProfile = async (username) => {
  const response = await api.get(`/api/users/${encodeURIComponent(username)}`)
  return response.data ?? null
}

// ── User Search ──

export const searchUsers = async (query, { limit = 20, offset = 0 } = {}) => {
  const params = { q: query, limit }
  if (offset) params.offset = offset

  try {
    const response = await api.get('/api/users/search', { params })
    return {
      users: Array.isArray(response.data) ? response.data : [],
      nextOffset: response.nextOffset ?? null,
    }
  } catch {
    return { users: [], nextOffset: null }
  }
}

// ── Follow ──

export const toggleFollow = async (username) => {
  const response = await api.post(`/api/users/${encodeURIComponent(username)}/follow`)
  return response.data ?? { following: false }
}

export const fetchMyFollowing = async () => {
  try {
    const response = await api.get('/api/me/following')
    return Array.isArray(response.data) ? response.data : []
  } catch {
    return []
  }
}

export const fetchMyFollowers = async () => {
  try {
    const response = await api.get('/api/me/followers')
    return Array.isArray(response.data) ? response.data : []
  } catch {
    return []
  }
}

// ── Reviews ──

// media: [{ id, alt }] from uploadReviewImage, or gif: a picked GIF. Never both.
export const saveMyReview = async (albumId, { content, albumName, albumCover, albumArtists, media = [], gif = null }) => {
  const response = await api.put(`/api/me/reviews/${encodeURIComponent(albumId)}`, {
    content,
    albumName,
    albumCover,
    albumArtists,
    media,
    gif,
  })
  return response.data ?? null
}

// The JSON default would make axios serialize the FormData; multipart lets the browser add the boundary.
export const uploadReviewImage = async ({ blob, width, height }, { signal } = {}) => {
  const form = new FormData()
  form.append('file', blob)
  form.append('width', String(width))
  form.append('height', String(height))
  const response = await api.post('/api/me/media', form, { headers: { 'Content-Type': 'multipart/form-data' }, signal })
  return response.data
}

export const searchGifs = async (query, { page = 1, signal } = {}) => {
  const response = await api.get('/api/gifs', { params: { q: query, page }, signal })
  return Array.isArray(response.data) ? response.data : []
}

export const fetchAlbumReviews = async (albumId, { cursor, limit = 10 } = {}) => {
  const params = { limit }
  if (cursor) params.cursor = cursor

  const response = await api.get(`/api/albums/${encodeURIComponent(albumId)}/reviews`, { params })
  return {
    reviews: Array.isArray(response.data) ? response.data : [],
    nextCursor: response.nextCursor ?? null,
  }
}

// ── Public lists ──

export const fetchPublicList = async (listId) => {
  if (!listId) return null

  const response = await api.get(`/api/lists/${encodeURIComponent(listId)}`)
  return response.data ?? null
}
