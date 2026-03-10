import { API_BASE_URL } from './authClient.js'

const toUrl = (path, params = {}) => {
  const url = new URL(`${API_BASE_URL}${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url
}

const parseApiError = async (response, fallbackMessage) => {
  let message = fallbackMessage
  try {
    const body = await response.json()
    if (body?.error) message = body.error
  } catch {
    // Ignore parse failures for non-JSON responses.
  }

  const error = new Error(message)
  error.status = response.status
  return error
}

const requestJson = async (fetcher, path, { params = {}, fallbackMessage = 'Something went wrong.' } = {}) => {
  const url = toUrl(path, params)
  const response = await fetcher(url.toString())

  if (!response.ok) {
    throw await parseApiError(response, fallbackMessage)
  }

  return response.json()
}

export const requestPublicJson = (path, options = {}) =>
  requestJson((url) => fetch(url), path, options)

export const requestPrivateJson = async (path, options = {}) => {
  const {
    method = 'GET',
    params = {},
    body,
    headers = {},
    fallbackMessage = 'Something went wrong.',
  } = options

  return requestJson(
    (url) =>
      fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body,
      }),
    path,
    { params, fallbackMessage },
  )
}
