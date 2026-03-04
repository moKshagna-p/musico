const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '')

const requestPrivateApi = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    let message = 'Something went wrong.'
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // ignore
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return response.json()
}

const requestPublicApi = async (path, params = {}) => {
  const url = new URL(`${API_BASE_URL}${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  const response = await fetch(url.toString())
  if (!response.ok) {
    let message = 'Something went wrong.'
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // ignore
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return response.json()
}

// ── Profile ──

export const fetchMyProfile = async () => {
  const response = await requestPrivateApi('/api/me/profile')
  return response?.data ?? null
}

export const updateMyProfile = async ({ username, bio, isPublic }) => {
  const body = {}
  if (username !== undefined) body.username = username
  if (bio !== undefined) body.bio = bio
  if (isPublic !== undefined) body.isPublic = isPublic

  const response = await requestPrivateApi('/api/me/profile', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return response?.data ?? null
}

export const checkUsernameAvailability = async (username) => {
  const response = await requestPublicApi('/api/username/check', { username })
  return response?.data ?? { available: false, valid: false }
}

// ── Public profiles ──

export const fetchPublicProfile = async (username) => {
  // Use credentialed request so the server can detect the current user
  // and return isFollowing / isOwnProfile accurately.
  const response = await requestPrivateApi(`/api/users/${encodeURIComponent(username)}`)
  return response?.data ?? null
}

// ── User Search ──

export const searchUsers = async (query, { limit = 20, offset = 0 } = {}) => {
  const params = { q: query, limit }
  if (offset) params.offset = offset

  // Use private API so the server can include follow status for the current user
  const response = await requestPrivateApi(`/api/users/search?${new URLSearchParams(
    Object.entries(params).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null) acc[k] = String(v)
      return acc
    }, {}),
  ).toString()}`)

  return {
    users: Array.isArray(response?.data) ? response.data : [],
    nextOffset: response?.nextOffset ?? null,
  }
}

// ── Follow ──

export const toggleFollow = async (username) => {
  const response = await requestPrivateApi(`/api/users/${encodeURIComponent(username)}/follow`, {
    method: 'POST',
  })
  return response?.data ?? { following: false }
}

export const fetchMyFollowing = async () => {
  const response = await requestPrivateApi('/api/me/following')
  return Array.isArray(response?.data) ? response.data : []
}

export const fetchMyFollowers = async () => {
  const response = await requestPrivateApi('/api/me/followers')
  return Array.isArray(response?.data) ? response.data : []
}

// ── Activity Feed ──

export const fetchMyFeed = async ({ cursor, limit = 20 } = {}) => {
  const params = { limit }
  if (cursor) params.cursor = cursor

  const response = await requestPrivateApi(`/api/me/feed?${new URLSearchParams(
    Object.entries(params).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null) acc[k] = String(v)
      return acc
    }, {}),
  ).toString()}`)

  return {
    items: Array.isArray(response?.data) ? response.data : [],
    nextCursor: response?.nextCursor ?? null,
  }
}

// ── Reviews ──

export const saveMyReview = async (albumId, { content, albumName, albumCover, albumArtists }) => {
  const response = await requestPrivateApi(`/api/me/reviews/${encodeURIComponent(albumId)}`, {
    method: 'PUT',
    body: JSON.stringify({ content, albumName, albumCover, albumArtists }),
  })
  return response?.data ?? null
}

export const deleteMyReview = async (albumId) => {
  const response = await requestPrivateApi(`/api/me/reviews/${encodeURIComponent(albumId)}`, {
    method: 'DELETE',
  })
  return response?.data ?? { deleted: true }
}

export const fetchMyReviews = async () => {
  const response = await requestPrivateApi('/api/me/reviews')
  return Array.isArray(response?.data) ? response.data : []
}

export const fetchAlbumReviews = async (albumId, { cursor, limit = 10 } = {}) => {
  const params = { limit }
  if (cursor) params.cursor = cursor

  const response = await requestPublicApi(
    `/api/albums/${encodeURIComponent(albumId)}/reviews`,
    params,
  )

  return {
    reviews: Array.isArray(response?.data) ? response.data : [],
    nextCursor: response?.nextCursor ?? null,
  }
}

// ── Public lists ──

export const fetchPublicList = async (listId) => {
  const response = await requestPublicApi(`/api/lists/${encodeURIComponent(listId)}`)
  return response?.data ?? null
}
