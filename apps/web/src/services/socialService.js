import api from './apiClient.js'

// ── Profile ──

export const fetchMyProfile = async () => {
  try {
    const response = await api.get('/api/me/profile')
    return response.data ?? null
  } catch {
    return null
  }
}

export const updateMyProfile = async ({ username, bio, image }) => {
  const payload = {}
  if (username !== undefined) payload.username = username
  if (bio !== undefined) payload.bio = bio
  if (image !== undefined) payload.image = image

  const response = await api.put('/api/me/profile', payload)
  return response.data ?? null
}

export const checkUsernameAvailability = async (username) => {
  try {
    const response = await api.get('/api/username/check', { params: { username } })
    return response.data ?? { available: false, valid: false }
  } catch {
    return { available: false, valid: false }
  }
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

// ── Activity Feed ──

export const fetchMyFeed = async ({ cursor, limit = 20 } = {}) => {
  const params = { limit }
  if (cursor) params.cursor = cursor

  try {
    const response = await api.get('/api/me/feed', { params })
    return {
      items: Array.isArray(response.data) ? response.data : [],
      nextCursor: response.nextCursor ?? null,
    }
  } catch {
    return { items: [], nextCursor: null }
  }
}

// ── Reviews ──

export const saveMyReview = async (albumId, { content, albumName, albumCover, albumArtists }) => {
  const response = await api.put(`/api/me/reviews/${encodeURIComponent(albumId)}`, { content, albumName, albumCover, albumArtists })
  return response.data ?? null
}

export const deleteMyReview = async (albumId) => {
  const response = await api.delete(`/api/me/reviews/${encodeURIComponent(albumId)}`)
  return response.data ?? { deleted: true }
}

export const fetchMyReviews = async () => {
  try {
    const response = await api.get('/api/me/reviews')
    return Array.isArray(response.data) ? response.data : []
  } catch {
    return []
  }
}

export const fetchAlbumReviews = async (albumId, { cursor, limit = 10 } = {}) => {
  const params = { limit }
  if (cursor) params.cursor = cursor

  try {
    const response = await api.get(`/api/albums/${encodeURIComponent(albumId)}/reviews`, { params })
    return {
      reviews: Array.isArray(response.data) ? response.data : [],
      nextCursor: response.nextCursor ?? null,
    }
  } catch {
    return { reviews: [], nextCursor: null }
  }
}

// ── Public lists ──

export const fetchPublicList = async (listId) => {
  try {
    const response = await api.get(`/api/lists/${encodeURIComponent(listId)}`)
    return response.data ?? null
  } catch {
    return null
  }
}
