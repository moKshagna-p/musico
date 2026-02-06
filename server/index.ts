import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'

import { getFeaturedReleases, getReleaseDetails, searchReleases } from './discogs'

const env = ((globalThis as unknown as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env ??
  process.env ??
  {}) as Record<string, string | undefined>

const PORT = Number(env.PORT ?? 4000)

const RATE_LIMIT_WINDOW = 1000 * 60 * 60 // 1 hour
const RATE_LIMIT_MAX = 100

const rateLimiter = new Map<string, { count: number; resetAt: number }>()

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? 'unknown'
  const realIp = request.headers.get('x-real-ip') ?? request.headers.get('x-client-ip')
  if (realIp) return realIp
  return request.headers.get('host') ?? 'local'
}

const consumeRateLimit = (ip: string) => {
  const now = Date.now()
  const entry = rateLimiter.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, retryAfter: RATE_LIMIT_WINDOW / 1000 }
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count += 1
  rateLimiter.set(ip, entry)
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
}

const allowedOrigin = env.ALLOWED_ORIGIN ?? '*'

const app = new Elysia()
  .use(
    cors({
      origin: allowedOrigin,
      methods: ['GET', 'OPTIONS'],
      credentials: false,
    }),
  )
  .derive(({ request }) => ({ clientIp: getClientIp(request) }))
  .onBeforeHandle(({ set, clientIp }) => {
    const rateLimit = consumeRateLimit(clientIp)
    set.headers ??= {}
    set.headers['X-RateLimit-Limit'] = `${RATE_LIMIT_MAX}`
    set.headers['X-RateLimit-Remaining'] = `${rateLimit.remaining}`

    if (!rateLimit.allowed) {
      set.status = 429
      set.headers['Retry-After'] = `${rateLimit.retryAfter}`
      return { error: 'Too many requests. Please try again soon.' }
    }
  })
  .get('/', () => ({
    status: 'ok',
    message: 'MuseVault API proxy is running.',
  }))
  .get('/api/featured', async ({ query, set }) => {
    try {
      const limitParam = Number(query?.limit)
      const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 24
      const refreshFlag = String(query?.refresh ?? '').toLowerCase()
      const forceRefresh = refreshFlag === '1' || refreshFlag === 'true'
      const data = await getFeaturedReleases(limit, forceRefresh)
      set.headers ??= {}
      set.headers['Cache-Control'] = 'public, max-age=60'
      return { data }
    } catch (error) {
      console.error('[featured] error', error)
      set.status = 502
      return { error: 'Unable to load featured releases right now.' }
    }
  })
  .get('/api/search', async ({ query, set }) => {
    const q = (query?.q ?? '').toString()
    if (!q.trim()) {
      set.status = 400
      return { error: 'Missing search query.' }
    }
    try {
      const data = await searchReleases(q)
      set.headers ??= {}
      set.headers['Cache-Control'] = 'public, max-age=60'
      return { data }
    } catch (error) {
      console.error('[search] error', error)
      set.status = 502
      return { error: 'Search unavailable right now. Please try again shortly.' }
    }
  })
  .get('/api/releases/:id', async ({ params, set }) => {
    if (!params?.id) {
      set.status = 400
      return { error: 'Missing release id.' }
    }
    try {
      const data = await getReleaseDetails(params.id)
      set.headers ??= {}
      set.headers['Cache-Control'] = 'public, max-age=60'
      return data
    } catch (error) {
      console.error('[release] error', error)
      set.status = 502
      return { error: 'Unable to load release details.' }
    }
  })
  .onError(({ code, error, set }) => {
    if (code === 'NOT_FOUND') {
      set.status = 404
      return { error: 'Route not found.' }
    }
    console.error('[server] unexpected', error)
    set.status = 500
    return { error: 'Unexpected server error.' }
  })
  .listen(PORT)

console.log(`MuseVault API server running on http://localhost:${app.server?.port ?? PORT}`)
