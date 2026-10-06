import { timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import process from 'node:process'

const allowedPath = /^\/(?:masters\/\d+|releases\/\d+|artists\/\d+\/releases|database\/search)$/
const allowedParams = new Set(['q', 'type', 'format', 'genre', 'style', 'year', 'artist', 'release_title', 'page', 'per_page', 'sort', 'sort_order'])

// Server-only relay: a separate egress path avoids the shared Workers client IP.
export default async function handler(request, response, {
  secret = process.env.DISCOGS_RELAY_SECRET,
  fetcher = globalThis.fetch,
} = {}) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' })
  if (!secret) return response.status(503).json({ error: 'Relay is not configured.' })
  const expected = Buffer.from(`Bearer ${secret}`)
  const supplied = Buffer.from(String(request.headers.authorization ?? ''))
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return response.status(401).json({ error: 'Unauthorized.' })
  }
  const incoming = new URL(request.url, 'https://musico-web.vercel.app')
  const path = incoming.searchParams.get('path') ?? ''
  if (!allowedPath.test(path) || incoming.searchParams.getAll('path').length !== 1) {
    return response.status(400).json({ error: 'Invalid Discogs path.' })
  }
  const upstream = new URL(path, 'https://api.discogs.com')
  for (const [key, value] of incoming.searchParams) {
    if (key === 'path') continue
    if (!allowedParams.has(key)) return response.status(400).json({ error: 'Invalid Discogs parameter.' })
    upstream.searchParams.append(key, value)
  }
  // Credentials stay in server-to-server headers and never reach browser responses.
  const headers = { 'User-Agent': 'musico/1.0 (+https://musico-web.vercel.app)', Accept: 'application/json' }
  const authorization = request.headers['x-discogs-authorization']
  if (typeof authorization === 'string') headers.Authorization = authorization
  for (const key of ['token', 'key', 'secret']) {
    const value = request.headers[`x-discogs-${key}`]
    if (typeof value === 'string' && value) upstream.searchParams.set(key, value)
  }
  try {
    const result = await fetcher(upstream, { headers, redirect: 'error', signal: AbortSignal.timeout(9000) })
    for (const key of ['content-type', 'retry-after', 'x-discogs-ratelimit', 'x-discogs-ratelimit-remaining', 'x-discogs-ratelimit-used']) {
      const value = result.headers.get(key)
      if (value) response.setHeader(key, value)
    }
    return response.status(result.status).send(await result.text())
  } catch {
    return response.status(502).json({ error: 'Discogs is temporarily unavailable.' })
  }
}
