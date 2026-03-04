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
    let message = 'Unable to sync profile data right now.'
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // Ignore response parse failures.
    }

    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return response.json()
}

export const fetchMyRatings = async () => {
  const response = await requestPrivateApi('/api/me/ratings')
  return response?.data && typeof response.data === 'object' ? response.data : {}
}

export const saveMyRating = async (albumId, rating, meta = {}) => {
  const body = { rating }
  if (meta.albumName) body.albumName = meta.albumName
  if (meta.albumCover) body.albumCover = meta.albumCover

  const response = await requestPrivateApi(`/api/me/ratings/${encodeURIComponent(albumId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

  return response?.data ?? { rating, timestamp: Date.now() }
}

export const fetchMyLists = async () => {
  const response = await requestPrivateApi('/api/me/lists')
  return Array.isArray(response?.data) ? response.data : []
}

export const createMyList = async (name) => {
  const response = await requestPrivateApi('/api/me/lists', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return response?.data ?? null
}

export const toggleAlbumInMyList = async (listId, album) => {
  const response = await requestPrivateApi(`/api/me/lists/${encodeURIComponent(listId)}/toggle`, {
    method: 'POST',
    body: JSON.stringify(album),
  })
  return response?.data ?? { added: false }
}
