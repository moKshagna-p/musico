import { requestPrivateJson, requestPublicJson } from './apiClient.js'

// ── Profile ──

export const fetchMyProfile = async () => {
  const response = await requestPrivateJson('/api/me/profile', {
    fallbackMessage: 'Unable to load profile data.',
  })
  return response?.data ?? null
}

export const updateMyProfile = async ({ username, bio, image }) => {
  const payload = {}
  if (username !== undefined) payload.username = username
  if (bio !== undefined) payload.bio = bio
  if (image !== undefined) payload.image = image

  const response = await requestPrivateJson('/api/me/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
    fallbackMessage: 'Unable to update profile.',
  })

  return response?.data ?? null
}

export const checkUsernameAvailability = async (username) => {
  const response = await requestPublicJson('/api/username/check', {
    params: { username },
    fallbackMessage: 'Unable to validate username.',
  })

  return response?.data ?? { available: false, valid: false }
}

// ── User Search ──

export const searchUsers = async (query, { limit = 20, offset = 0 } = {}) => {
  const params = { q: query, limit }
  if (offset) params.offset = offset

  const response = await requestPrivateJson('/api/users/search', {
    params,
    fallbackMessage: 'Unable to search users.',
  })

  return {
    users: Array.isArray(response?.data) ? response.data : [],
    nextOffset: response?.nextOffset ?? null,
  }
}

// ── Follow ──

export const toggleFollow = async (username) => {
  const response = await requestPrivateJson(`/api/users/${encodeURIComponent(username)}/follow`, {
    method: 'POST',
    fallbackMessage: 'Unable to update follow status.',
  })

  return response?.data ?? { following: false }
}

export const fetchMyFollowing = async () => {
  const response = await requestPrivateJson('/api/me/following', {
    fallbackMessage: 'Unable to load following list.',
  })
  return Array.isArray(response?.data) ? response.data : []
}

export const fetchMyFollowers = async () => {
  const response = await requestPrivateJson('/api/me/followers', {
    fallbackMessage: 'Unable to load followers list.',
  })
  return Array.isArray(response?.data) ? response.data : []
}

// ── Activity Feed ──

export const fetchMyFeed = async ({ cursor, limit = 20 } = {}) => {
  const params = { limit }
  if (cursor) params.cursor = cursor

  const response = await requestPrivateJson('/api/me/feed', {
    params,
    fallbackMessage: 'Unable to load feed.',
  })

  return {
    items: Array.isArray(response?.data) ? response.data : [],
    nextCursor: response?.nextCursor ?? null,
  }
}

// ── Reviews ──

export const saveMyReview = async (albumId, { content, albumName, albumCover, albumArtists }) => {
  const response = await requestPrivateJson(`/api/me/reviews/${encodeURIComponent(albumId)}`, {
    method: 'PUT',
    body: JSON.stringify({ content, albumName, albumCover, albumArtists }),
    fallbackMessage: 'Unable to save review.',
  })

  return response?.data ?? null
}

export const deleteMyReview = async (albumId) => {
  const response = await requestPrivateJson(`/api/me/reviews/${encodeURIComponent(albumId)}`, {
    method: 'DELETE',
    fallbackMessage: 'Unable to delete review.',
  })

  return response?.data ?? { deleted: true }
}

export const fetchMyReviews = async () => {
  const response = await requestPrivateJson('/api/me/reviews', {
    fallbackMessage: 'Unable to load reviews.',
  })
  return Array.isArray(response?.data) ? response.data : []
}

export const fetchAlbumReviews = async (albumId, { cursor, limit = 10 } = {}) => {
  const params = { limit }
  if (cursor) params.cursor = cursor

  const response = await requestPublicJson(`/api/albums/${encodeURIComponent(albumId)}/reviews`, {
    params,
    fallbackMessage: 'Unable to load album reviews.',
  })

  return {
    reviews: Array.isArray(response?.data) ? response.data : [],
    nextCursor: response?.nextCursor ?? null,
  }
}

// ── Public lists ──

export const fetchPublicList = async (listId) => {
  const response = await requestPublicJson(`/api/lists/${encodeURIComponent(listId)}`, {
    fallbackMessage: 'Unable to load list.',
  })
  return response?.data ?? null
}
