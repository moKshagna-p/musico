import { createAuthClient } from 'better-auth/react'

// Environment-aware API resolution
const getApiBaseUrl = () => {
  // If we are on Vercel production, we MUST use relative paths to trigger the vercel.json rewrite.
  // This makes Safari think the API is on the same domain, fixing the cookie blocking.
  if (typeof window !== 'undefined' && (
    window.location.hostname.includes('vercel.app') || 
    window.location.hostname === 'musico-web.vercel.app'
  )) {
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
