const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && (
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname === 'musico-web.vercel.app'
  )) {
    return window.location.origin
  }
  return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000')
}

export const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '')
