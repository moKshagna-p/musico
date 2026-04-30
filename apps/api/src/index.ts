import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { sql } from 'drizzle-orm'

import { auth } from './auth'
import { db } from './core/db'
import { env } from './core/env'
import {
  log,
  consumeRateLimit,
  getClientIp,
} from './core/utils'
import { RATE_LIMIT_MAX } from './core/constants'

// Import routes
import { apiRoutes } from './routes'

const allowedOrigin = env.ALLOWED_ORIGINS

export const createApp = (options?: ConstructorParameters<typeof Elysia>[0]) => new Elysia(options)
  .derive(({ request, set }) => {
    const requestId = crypto.randomUUID()
    set.headers ??= {}
    set.headers['X-Request-Id'] = requestId
    return { requestId, requestStartedAt: Date.now(), requestPath: new URL(request.url).pathname }
  })
  .onAfterHandle(({ request, set, requestId, requestStartedAt, requestPath }) => {
    log('info', 'request.completed', {
      requestId,
      method: request.method,
      path: requestPath,
      status: Number(set.status ?? 200),
      durationMs: Date.now() - requestStartedAt,
    })
  })
  .onError(({ code, error, request, requestId, requestPath, set }) => {
    log('error', 'request.failed', {
      requestId,
      code,
      message: String(error?.message ?? 'Unknown error'),
      method: request.method,
      path: requestPath,
      status: Number(set.status ?? 500),
    })
  })
  .use(
    cors({
      origin: allowedOrigin,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Set-Cookie'],
      exposedHeaders: ['Set-Cookie'],
    }),
  )
  .mount(auth.handler)
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
    message: 'Musico API proxy is running.',
  }))
  .get('/health', () => ({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
  }))
  .get('/ready', async ({ set }) => {
    try {
      await db.execute(sql`select 1`)
      return { status: 'ready' }
    } catch (error) {
      set.status = 503
      return {
        status: 'not_ready',
        error: error instanceof Error ? error.message : 'Database unavailable.',
      }
    }
  })
  .use(apiRoutes)

export { env } from './core/env'
export { log } from './core/utils'
export const app = createApp()
