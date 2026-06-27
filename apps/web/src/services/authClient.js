import { createAuthClient } from 'better-auth/react'
import { API_BASE_URL } from './config.js'

let _client = null
export const getAuthClient = () => {
  if (!_client) {
    _client = createAuthClient({
      baseURL: API_BASE_URL,
      fetchOptions: { credentials: 'include' },
      disableCookieCache: true,
    })
  }
  return _client
}
