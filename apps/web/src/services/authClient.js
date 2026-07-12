import { createAuthClient } from 'better-auth/react'

// Environment-aware API resolution
const getApiBaseUrl = () => {
  // Production requests use the Vercel rewrite, including custom domains.
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    return window.location.origin
  }

  // Local development fallback
  return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000')
}

export const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '')

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  fetchOptions: {
    credentials: 'include',
  },
  disableCookieCache: true,
})
