import api from './apiClient.js'

export const fetchAdminMe = async () => {
  const response = await api.get('/api/admin/me')
  return response.data ?? { isAdmin: false }
}

export const fetchAdminUsers = async ({ q = '', limit = 25 } = {}) => {
  const params = { limit }
  if (q?.trim()) params.q = q.trim()

  const response = await api.get('/api/admin/users', { params })
  return Array.isArray(response.data) ? response.data : []
}

export const setUserAdminRole = async (userId, isAdmin) => {
  const response = await api.put(`/api/admin/users/${encodeURIComponent(userId)}/admin`, { isAdmin })
  return response.data ?? null
}

export const fetchAdminOverview = async () => {
  const response = await api.get('/api/admin/overview')
  return response.data ?? null
}

export const fetchAdminReviews = async ({ status = 'all', limit = 20 } = {}) => {
  const response = await api.get('/api/admin/reviews', {
    params: { status, limit },
  })
  return Array.isArray(response.data) ? response.data : []
}

export const deleteAdminReview = async (reviewId) => {
  const response = await api.delete(`/api/admin/reviews/${encodeURIComponent(reviewId)}`)
  return response.data ?? { deleted: false }
}
