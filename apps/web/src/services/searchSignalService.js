import { requestPrivateJson } from './apiClient.js'

export const recordSearchSignal = async (query) => {
  const trimmed = query?.trim()
  if (!trimmed) return

  try {
    await requestPrivateJson('/api/search-events', {
      method: 'POST',
      body: JSON.stringify({ query: trimmed }),
      fallbackMessage: 'Unable to record search signal.',
    })
  } catch {
    // Search logging must never block the user flow.
  }
}
