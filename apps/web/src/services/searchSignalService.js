import api from './apiClient.js'

export const recordSearchSignal = async (query) => {
  const trimmed = query?.trim()
  if (!trimmed) return

  try {
    await api.post('/api/search-events', { query: trimmed })
  } catch {
    // Search logging must never block the user flow.
  }
}
