import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { and, desc, eq, ilike, inArray, lt, or, sql } from 'drizzle-orm'

import { auth } from './auth'
import { db } from './db'
import { getReleaseDetails, searchReleases } from './discogs'
import { env, validateProductionEnv } from './env'
import { recordSearchQuery } from './searchSignals'
import {
  activity,
  user,
  userFollow,
  userList,
  userListAlbum,
  userProfile,
  userRating,
  userReview,
} from './schema'
import {
  getFeaturedFallbackReleases,
  getRecentPopularFallbackReleases,
  getStoredTrendingAlbumsEnsuringFresh,
  isStoredTrendingTableMissingError,
  refreshStoredTrendingAlbums,
  refreshStoredHomeAlbums,
} from './trending'

validateProductionEnv()

const PORT = env.PORT

const RATE_LIMIT_WINDOW = 1000 * 60 * 60 // 1 hour
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_MAX_TRACKED_IPS = 10000
const MAX_LISTS_PER_USER = 30
const MAX_ALBUMS_PER_LIST = 200
const MAX_REVIEW_LENGTH = 280
const MAX_BIO_LENGTH = 160
const MAX_RELEASE_PREVIEW_LOOKUPS = 36
const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/

const normalizeRating = (value: number) => {
  if (!Number.isFinite(value)) return null
  const normalized = Math.round(value * 2) / 2
  if (normalized < 0.5 || normalized > 5) return null
  return normalized
}

const rateLimiter = new Map<string, { count: number; resetAt: number }>()

const log = (level: 'info' | 'warn' | 'error', message: string, data: Record<string, unknown> = {}) => {
  const timestamp = new Date().toISOString()
  const entry = { level, message, timestamp, ...data }
  const serialized = JSON.stringify(entry)
  if (level === 'error') {
    console.error(serialized)
    return
  }
  if (level === 'warn') {
    console.warn(serialized)
    return
  }
  console.log(serialized)
}

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? 'unknown'
  const realIp = request.headers.get('x-real-ip') ?? request.headers.get('x-client-ip')
  if (realIp) return realIp
  return request.headers.get('host') ?? 'local'
}

const consumeRateLimit = (ip: string) => {
  const now = Date.now()
  if (rateLimiter.size > RATE_LIMIT_MAX_TRACKED_IPS) {
    for (const [trackedIp, tracked] of rateLimiter) {
      if (tracked.resetAt <= now) {
        rateLimiter.delete(trackedIp)
      }
      if (rateLimiter.size <= RATE_LIMIT_MAX_TRACKED_IPS) break
    }
  }

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

const allowedOrigin = env.ALLOWED_ORIGINS

const normalizeListName = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 48)

const toSafeArtists = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value.filter(Boolean).map((entry) => String(entry)).slice(0, 3)
}

const parseReleaseYear = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

const parseProfileImage = (value: unknown) => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null

  if (trimmed.startsWith('data:image/')) {
    const maxBytes = 1024 * 1024 * 2
    return trimmed.length <= maxBytes * 1.4 ? trimmed : null
  }

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

const normalizeAlbumId = (value: unknown) => String(value ?? '').trim()

const getReleasePreviewMap = async (albumIds: unknown[]) => {
  const uniqueAlbumIds = [...new Set(albumIds.map(normalizeAlbumId).filter(Boolean))].slice(0, MAX_RELEASE_PREVIEW_LOOKUPS)
  if (!uniqueAlbumIds.length) {
    return new Map<string, { name: string; cover: string; artists: string[]; releaseYear: number | null }>()
  }

  const previews = await Promise.allSettled(
    uniqueAlbumIds.map(async (albumId) => {
      const details = await getReleaseDetails(albumId)
      return [
        albumId,
        {
          name: String(details.name ?? '').trim(),
          cover: String(details.cover ?? '').trim(),
          artists: Array.isArray(details.artists) ? details.artists.filter(Boolean).map(String) : [],
          releaseYear: Number.isFinite(Number(details.releaseYear)) ? Number(details.releaseYear) : null,
        },
      ] as const
    }),
  )

  return new Map(
    previews
      .filter(
        (
          entry,
        ): entry is PromiseFulfilledResult<
          readonly [string, { name: string; cover: string; artists: string[]; releaseYear: number | null }]
        > => entry.status === 'fulfilled',
      )
      .map((entry) => entry.value),
  )
}

const getCanonicalAlbumMetadata = async (
  albumId: string,
  fallback: {
    name?: unknown
    cover?: unknown
    artists?: unknown
    releaseYear?: unknown
  } = {},
) => {
  const fallbackMeta = {
    name: String(fallback.name ?? 'Untitled').trim() || 'Untitled',
    cover: String(fallback.cover ?? '').trim(),
    artists: toSafeArtists(fallback.artists),
    releaseYear: parseReleaseYear(fallback.releaseYear),
  }

  const shouldUseFallbackFirst = fallbackMeta.name !== 'Untitled'
  if (shouldUseFallbackFirst) {
    return fallbackMeta
  }

  try {
    const details = await getReleaseDetails(albumId)
    return {
      name: String(details.name ?? fallback.name ?? 'Untitled').trim() || 'Untitled',
      cover: String(details.cover ?? fallback.cover ?? '').trim(),
      artists: Array.isArray(details.artists) ? details.artists.filter(Boolean).map(String).slice(0, 3) : toSafeArtists(fallback.artists),
      releaseYear: Number.isFinite(Number(details.releaseYear)) ? Number(details.releaseYear) : parseReleaseYear(fallback.releaseYear),
    }
  } catch {
    return fallbackMeta
  }
}

const getAuthUser = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user ?? null
}

const ensureAuthenticated = async (request: Request, set: { status?: number }) => {
  const user = await getAuthUser(request)
  if (!user?.id) {
    set.status = 401
    return null
  }
  return user
}

const authorizeCron = (request: Request, set: { status?: number }) => {
  if (!env.CRON_SECRET) {
    set.status = 500
    return { error: 'CRON_SECRET is not configured.' }
  }

  const authorization = request.headers.get('authorization') ?? ''
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  const headerToken = request.headers.get('x-cron-secret')?.trim() ?? ''
  const providedSecret = bearerToken || headerToken

  if (providedSecret !== env.CRON_SECRET) {
    set.status = 401
    return { error: 'Unauthorized cron request.' }
  }

  return null
}

const attachMusicoCommunityStats = async <T extends { id: string; communityRating?: number; reviewCount?: number }>(
  releases: T[],
) => {
  const releaseIds = [...new Set(releases.map((release) => String(release.id ?? '').trim()).filter(Boolean))]
  if (!releaseIds.length) return releases

  const ratingRows = await db
    .select({
      albumId: userRating.albumId,
      averageRating: sql<number>`coalesce(avg(${userRating.rating}), 0)`,
      ratingCount: sql<number>`count(*)`,
    })
    .from(userRating)
    .where(inArray(userRating.albumId, releaseIds))
    .groupBy(userRating.albumId)

  const statsByAlbumId = new Map(
    ratingRows.map((row) => [
      row.albumId,
      {
        communityRating: Number(Number(row.averageRating ?? 0).toFixed(1)),
        reviewCount: Number(row.ratingCount ?? 0),
      },
    ]),
  )

  return releases.map((release) => {
    const stats = statsByAlbumId.get(String(release.id))
    return {
      ...release,
      communityRating: stats?.communityRating ?? 0,
      reviewCount: stats?.reviewCount ?? 0,
    }
  })
}

const loadStoredFeaturedSection = async (mode: 'featured' | 'recent-popular', limit: number) => {
  try {
    const data = await getStoredTrendingAlbumsEnsuringFresh(limit, mode)
    if (data.length) return data

    console.warn('[featured] stored snapshot empty, falling back to Discogs cache', { mode, limit })
    return mode === 'recent-popular'
      ? await getRecentPopularFallbackReleases(limit)
      : await getFeaturedFallbackReleases(limit)
  } catch (error) {
    if (!isStoredTrendingTableMissingError(error)) throw error

    console.warn('[featured] stored_trending_album missing, falling back to Discogs cache', { mode, limit })
    return mode === 'recent-popular'
      ? await getRecentPopularFallbackReleases(limit)
      : await getFeaturedFallbackReleases(limit)
  }
}

// Helper to record an activity event (fire-and-forget, never blocks the response)
const recordActivity = (params: {
  userId: string
  type: 'rated' | 'reviewed' | 'listed' | 'followed'
  albumId?: string | null
  albumName?: string | null
  albumCover?: string | null
  targetUserId?: string | null
  metadata?: Record<string, unknown>
}) => {
  const now = new Date()
  db.insert(activity)
    .values({
      id: crypto.randomUUID(),
      userId: params.userId,
      type: params.type,
      albumId: params.albumId ?? null,
      albumName: params.albumName ?? null,
      albumCover: params.albumCover ?? null,
      targetUserId: params.targetUserId ?? null,
      metadata: params.metadata ?? {},
      createdAt: now,
    })
    .catch((err) =>
      log('error', 'activity.record_failed', {
        userId: params.userId,
        type: params.type,
        message: String(err?.message ?? 'Unknown error'),
      }),
    )
}

// Helper to get or create a user profile row
const ensureUserProfile = async (userId: string) => {
  const existing = await db.select().from(userProfile).where(eq(userProfile.userId, userId)).limit(1)
  if (existing[0]) return existing[0]

  const now = new Date()
  const created = {
    userId,
    username: null,
    bio: '',
    isPublic: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(userProfile).values(created).onConflictDoNothing()
  // Re-fetch to handle race conditions
  const refetched = await db.select().from(userProfile).where(eq(userProfile.userId, userId)).limit(1)
  return refetched[0] ?? created
}

const app = new Elysia()
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

  // ── Existing rating routes ──

  .get('/api/me/ratings', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const rows = await db.select().from(userRating).where(eq(userRating.userId, authUser.id))
    const data = rows.reduce(
      (acc, row) => {
        acc[row.albumId] = {
          rating: row.rating,
          timestamp: row.updatedAt.getTime(),
        }
        return acc
      },
      {} as Record<string, { rating: number; timestamp: number }>,
    )

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data }
  })
  .put('/api/me/ratings/:albumId', async ({ request, params, body, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const albumId = String(params?.albumId ?? '').trim()
    const typedBody = body as { rating?: unknown; albumName?: unknown; albumCover?: unknown }
    const rating = normalizeRating(Number(typedBody?.rating))

    if (!albumId) {
      set.status = 400
      return { error: 'Missing album id.' }
    }

    if (rating === null) {
      set.status = 400
      return { error: 'Rating must be between 0.5 and 5 in 0.5 steps.' }
    }

    const albumMeta = await getCanonicalAlbumMetadata(albumId, {
      name: typedBody?.albumName,
      cover: typedBody?.albumCover,
    })

    const now = new Date()
    await db
      .insert(userRating)
      .values({
        id: crypto.randomUUID(),
        userId: authUser.id,
        albumId,
        rating,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userRating.userId, userRating.albumId],
        set: {
          rating,
          updatedAt: now,
        },
      })

    const [communityStats] = await db
      .select({
        averageRating: sql<number>`coalesce(avg(${userRating.rating}), 0)`,
        ratingCount: sql<number>`count(*)`,
      })
      .from(userRating)
      .where(eq(userRating.albumId, albumId))

    // Record activity for the feed
    recordActivity({
      userId: authUser.id,
      type: 'rated',
      albumId,
      albumName: albumMeta.name || null,
      albumCover: albumMeta.cover || null,
      metadata: { rating },
    })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        rating,
        timestamp: now.getTime(),
        communityRating: Number(Number(communityStats?.averageRating ?? 0).toFixed(1)),
        reviewCount: Number(communityStats?.ratingCount ?? 0),
      },
    }
  })
  .delete('/api/me/ratings/:albumId', async ({ request, params, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const albumId = String(params?.albumId ?? '').trim()
    if (!albumId) {
      set.status = 400
      return { error: 'Missing album id.' }
    }

    await db.delete(userRating).where(and(eq(userRating.userId, authUser.id), eq(userRating.albumId, albumId)))

    const [communityStats] = await db
      .select({
        averageRating: sql<number>`coalesce(avg(${userRating.rating}), 0)`,
        ratingCount: sql<number>`count(*)`,
      })
      .from(userRating)
      .where(eq(userRating.albumId, albumId))

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        rating: null,
        timestamp: Date.now(),
        communityRating: Number(Number(communityStats?.averageRating ?? 0).toFixed(1)),
        reviewCount: Number(communityStats?.ratingCount ?? 0),
      },
    }
  })

  // ── Existing list routes ──

  .get('/api/me/lists', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const lists = await db.select().from(userList).where(eq(userList.userId, authUser.id))
    if (!lists.length) {
      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return { data: [] }
    }

    const listIds = lists.map((entry) => entry.id)
    const albums = await db.select().from(userListAlbum).where(inArray(userListAlbum.listId, listIds))
    const albumsByList = new Map<string, typeof albums>()

    albums.forEach((entry) => {
      const group = albumsByList.get(entry.listId) ?? []
      group.push(entry)
      albumsByList.set(entry.listId, group)
    })

    const previewAlbumIds = [...lists]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .flatMap((list) =>
        (albumsByList.get(list.id) ?? [])
          .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
          .slice(0, 4)
          .map((album) => album.albumId),
      )

    const releasePreviewMap = await getReleasePreviewMap(previewAlbumIds)

    const data = [...lists]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((list) => {
        const listAlbums = (albumsByList.get(list.id) ?? [])
          .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
          .map((album) => {
            const preview = releasePreviewMap.get(album.albumId)
            return {
              id: album.albumId,
              name: preview?.name || album.name,
              cover: preview?.cover || album.cover,
              artists: preview?.artists?.length ? preview.artists : Array.isArray(album.artists) ? album.artists : [],
              releaseYear: preview?.releaseYear ?? album.releaseYear,
              addedAt: album.addedAt.getTime(),
            }
          })

        return {
          id: list.id,
          name: list.name,
          albums: listAlbums,
          createdAt: list.createdAt.getTime(),
          updatedAt: list.updatedAt.getTime(),
        }
      })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data }
  })
  .post('/api/me/lists', async ({ request, body, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const typedBody = body as {
      name?: unknown
      album?: {
        id?: unknown
        name?: unknown
        cover?: unknown
        artists?: unknown
        releaseYear?: unknown
      }
    }

    const name = normalizeListName(typedBody?.name)
    const initialAlbum = typedBody?.album
    const initialAlbumId = String(initialAlbum?.id ?? '').trim()
    if (!name) {
      set.status = 400
      return { error: 'List name is required.' }
    }

    const currentLists = await db.select().from(userList).where(eq(userList.userId, authUser.id))
    if (currentLists.length >= MAX_LISTS_PER_USER) {
      set.status = 400
      return { error: 'List limit reached.' }
    }

    const duplicate = currentLists.some((entry) => entry.name.toLowerCase() === name.toLowerCase())
    if (duplicate) {
      set.status = 409
      return { error: 'List name already exists.' }
    }

    const now = new Date()
    const created = {
      id: crypto.randomUUID(),
      userId: authUser.id,
      name,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(userList).values(created)

    let initialAlbumEntry: {
      id: string
      name: string
      cover: string
      artists: string[]
      releaseYear: number | null
      addedAt: number
    } | null = null

    if (initialAlbumId) {
      const albumMeta = await getCanonicalAlbumMetadata(initialAlbumId, {
        name: initialAlbum?.name,
        cover: initialAlbum?.cover,
        artists: initialAlbum?.artists,
        releaseYear: initialAlbum?.releaseYear,
      })

      await db.insert(userListAlbum).values({
        id: crypto.randomUUID(),
        listId: created.id,
        albumId: initialAlbumId,
        name: albumMeta.name,
        cover: albumMeta.cover,
        artists: albumMeta.artists,
        releaseYear: albumMeta.releaseYear,
        addedAt: now,
      })

      recordActivity({
        userId: authUser.id,
        type: 'listed',
        albumId: initialAlbumId,
        albumName: albumMeta.name,
        albumCover: albumMeta.cover,
        metadata: { listName: created.name, listId: created.id },
      })

      initialAlbumEntry = {
        id: initialAlbumId,
        name: albumMeta.name,
        cover: albumMeta.cover,
        artists: albumMeta.artists,
        releaseYear: albumMeta.releaseYear,
        addedAt: now.getTime(),
      }
    }

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        id: created.id,
        name: created.name,
        albums: initialAlbumEntry ? [initialAlbumEntry] : [],
        createdAt: created.createdAt.getTime(),
        updatedAt: created.updatedAt.getTime(),
        added: Boolean(initialAlbumEntry),
      },
    }
  })
  .post('/api/me/lists/:listId/toggle', async ({ request, params, body, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const listId = String(params?.listId ?? '').trim()
    const album = body as {
      id?: unknown
      name?: unknown
      cover?: unknown
      artists?: unknown
      releaseYear?: unknown
    }
    const albumId = String(album?.id ?? '').trim()

    if (!listId || !albumId) {
      set.status = 400
      return { error: 'Missing list id or album id.' }
    }

    const lists = await db
      .select({ id: userList.id, name: userList.name })
      .from(userList)
      .where(and(eq(userList.id, listId), eq(userList.userId, authUser.id)))
      .limit(1)

    const targetList = lists[0]
    if (!targetList) {
      set.status = 404
      return { error: 'List not found.' }
    }

    const existing = await db
      .select({ id: userListAlbum.id })
      .from(userListAlbum)
      .where(and(eq(userListAlbum.listId, listId), eq(userListAlbum.albumId, albumId)))
      .limit(1)

    const now = new Date()

    if (existing[0]) {
      await db.delete(userListAlbum).where(eq(userListAlbum.id, existing[0].id))
      await db.update(userList).set({ updatedAt: now }).where(eq(userList.id, listId))

      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return {
        data: {
          added: false,
          listName: targetList.name,
        },
      }
    }

    const [currentCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userListAlbum)
      .where(eq(userListAlbum.listId, listId))

    if (Number(currentCountRow?.count ?? 0) >= MAX_ALBUMS_PER_LIST) {
      set.status = 400
      return { error: 'This list is full.' }
    }

    const albumMeta = await getCanonicalAlbumMetadata(albumId, {
      name: album?.name,
      cover: album?.cover,
      artists: album?.artists,
      releaseYear: album?.releaseYear,
    })

    await db.insert(userListAlbum).values({
      id: crypto.randomUUID(),
      listId,
      albumId,
      name: albumMeta.name,
      cover: albumMeta.cover,
      artists: albumMeta.artists,
      releaseYear: albumMeta.releaseYear,
      addedAt: now,
    })
    await db.update(userList).set({ updatedAt: now }).where(eq(userList.id, listId))

    // Record activity for the feed
    recordActivity({
      userId: authUser.id,
      type: 'listed',
      albumId,
      albumName: albumMeta.name,
      albumCover: albumMeta.cover,
      metadata: { listName: targetList.name, listId },
    })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        added: true,
        listName: targetList.name,
      },
    }
  })

  // ── Profile routes ──

  .get('/api/me/profile', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const profile = await ensureUserProfile(authUser.id)

    const [followerCountRows, followingCountRows, recentRatingsRows, ratingActivityRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followingId, authUser.id)),
      db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followerId, authUser.id)),
      db
        .select({
          albumId: userRating.albumId,
          rating: userRating.rating,
          updatedAt: userRating.updatedAt,
        })
        .from(userRating)
        .where(eq(userRating.userId, authUser.id))
        .orderBy(desc(userRating.updatedAt))
        .limit(10),
      db
        .select({
          albumId: activity.albumId,
          albumName: activity.albumName,
          albumCover: activity.albumCover,
          createdAt: activity.createdAt,
        })
        .from(activity)
        .where(and(eq(activity.userId, authUser.id), eq(activity.type, 'rated')))
        .orderBy(desc(activity.createdAt))
        .limit(50),
    ])

    const followerCount = Number(followerCountRows[0]?.count ?? 0)
    const followingCount = Number(followingCountRows[0]?.count ?? 0)

    const releasePreviewMap = await getReleasePreviewMap(recentRatingsRows.map((row) => row.albumId))

    const latestActivityByAlbum = new Map<string, { albumName: string | null; albumCover: string | null }>()
    for (const row of ratingActivityRows) {
      const albumId = String(row.albumId ?? '').trim()
      if (!albumId || latestActivityByAlbum.has(albumId)) continue
      latestActivityByAlbum.set(albumId, {
        albumName: row.albumName ? String(row.albumName) : null,
        albumCover: row.albumCover ? String(row.albumCover) : null,
      })
    }

    const recentRatings = recentRatingsRows.map((row) => {
      const activityMeta = latestActivityByAlbum.get(String(row.albumId))
      const preview = releasePreviewMap.get(String(row.albumId))
      return {
        albumId: row.albumId,
        rating: row.rating,
        timestamp: row.updatedAt.getTime(),
        albumName: preview?.name || activityMeta?.albumName || '',
        albumCover: preview?.cover || activityMeta?.albumCover || '',
      }
    })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        username: profile.username,
        bio: profile.bio,
        isPublic: profile.isPublic,
        image: authUser.image ?? null,
        followerCount,
        followingCount,
        recentRatings,
      },
    }
  })
  .put('/api/me/profile', async ({ request, body, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const typed = body as { username?: unknown; bio?: unknown; isPublic?: unknown; image?: unknown }
    const updates: Record<string, unknown> = {}
    const userUpdates: Record<string, unknown> = {}
    const now = new Date()

    // Validate and set username
    if (typed.username !== undefined) {
      const rawUsername = String(typed.username ?? '').trim().toLowerCase()
      if (!rawUsername) {
        // Allow clearing username
        updates.username = null
      } else if (!USERNAME_REGEX.test(rawUsername)) {
        set.status = 400
        return { error: 'Username must be 3-24 characters, lowercase letters, numbers, and hyphens only.' }
      } else {
        // Check uniqueness
        const existing = await db
          .select({ userId: userProfile.userId })
          .from(userProfile)
          .where(eq(userProfile.username, rawUsername))
          .limit(1)
        if (existing[0] && existing[0].userId !== authUser.id) {
          set.status = 409
          return { error: 'Username is already taken.' }
        }
        updates.username = rawUsername
      }
    }

    // Validate and set bio
    if (typed.bio !== undefined) {
      updates.bio = String(typed.bio ?? '').trim().slice(0, MAX_BIO_LENGTH)
    }

    // Validate and set isPublic
    if (typed.isPublic !== undefined) {
      updates.isPublic = Boolean(typed.isPublic)
    }

    if (typed.image !== undefined) {
      const parsedImage = parseProfileImage(typed.image)
      const rawImage = String(typed.image ?? '').trim()
      if (rawImage && !parsedImage) {
        set.status = 400
        return { error: 'Profile image must be a valid http or https URL.' }
      }
      userUpdates.image = parsedImage
    }

    if (!Object.keys(updates).length && !Object.keys(userUpdates).length) {
      set.status = 400
      return { error: 'No valid fields to update.' }
    }

    await ensureUserProfile(authUser.id)
    await db
      .update(userProfile)
      .set({ ...updates, updatedAt: now })
      .where(eq(userProfile.userId, authUser.id))

    if (Object.keys(userUpdates).length) {
      await db
        .update(user)
        .set({ ...userUpdates, updatedAt: now })
        .where(eq(user.id, authUser.id))
    }

    const [updatedProfile] = await db.select().from(userProfile).where(eq(userProfile.userId, authUser.id)).limit(1)
    const [updatedUser] = await db.select().from(user).where(eq(user.id, authUser.id)).limit(1)

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        username: updatedProfile?.username ?? null,
        bio: updatedProfile?.bio ?? '',
        isPublic: updatedProfile?.isPublic ?? true,
        image: updatedUser?.image ?? null,
      },
    }
  })

  // Check username availability
  .get('/api/username/check', async ({ query, set }) => {
    const username = String(query?.username ?? '').trim().toLowerCase()
    if (!username || !USERNAME_REGEX.test(username)) {
      return { data: { available: false, valid: false } }
    }

    const existing = await db
      .select({ userId: userProfile.userId })
      .from(userProfile)
      .where(eq(userProfile.username, username))
      .limit(1)

    return { data: { available: !existing[0], valid: true } }
  })

  // ── Public profile routes ──

  .get('/api/users/:username', async ({ params, request, set }) => {
    const username = String(params?.username ?? '').trim().toLowerCase()
    if (!username) {
      set.status = 400
      return { error: 'Missing username.' }
    }

    const profiles = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.username, username))
      .limit(1)

    const profile = profiles[0]
    if (!profile) {
      set.status = 404
      return { error: 'User not found.' }
    }

    // Fetch user info
    const users = await db.select().from(user).where(eq(user.id, profile.userId)).limit(1)
    const targetUser = users[0]
    if (!targetUser) {
      set.status = 404
      return { error: 'User not found.' }
    }

    // Check if the requesting user is the owner or following this profile
    const authUser = await getAuthUser(request)
    const isOwnProfile = authUser?.id === profile.userId

    // If the profile is private, return limited info
    if (!profile.isPublic && !isOwnProfile) {
      // Check follow status
      let isFollowing = false
      if (authUser?.id) {
        const followRow = await db
          .select({ id: userFollow.id })
          .from(userFollow)
          .where(and(eq(userFollow.followerId, authUser.id), eq(userFollow.followingId, profile.userId)))
          .limit(1)
        isFollowing = Boolean(followRow[0])
      }

      // Count followers/following even for private profiles (public metadata)
      const [followerCountRows, followingCountRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followingId, profile.userId)),
        db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followerId, profile.userId)),
      ])

      const followerCount = Number(followerCountRows[0]?.count ?? 0)
      const followingCount = Number(followingCountRows[0]?.count ?? 0)

      set.headers ??= {}
      set.headers['Cache-Control'] = 'public, max-age=30'
      return {
        data: {
          userId: profile.userId,
          name: targetUser.name,
          username: profile.username,
          bio: null,
          isPrivate: true,
          joinedAt: targetUser.createdAt.getTime(),
          stats: null,
          followerCount,
          followingCount,
          isFollowing,
          isOwnProfile: false,
          recentRatings: [],
          recentReviews: [],
          lists: [],
        },
      }
    }

    // Fetch stats in parallel
    const [ratingSummaryRows, reviewSummaryRows, recentRatingsRows, recentReviewsRows, lists, followerCountRows, followingCountRows] = await Promise.all([
      db
        .select({
          totalRated: sql<number>`count(*)`,
          averageRating: sql<number>`coalesce(avg(${userRating.rating}), 0)`,
        })
        .from(userRating)
        .where(eq(userRating.userId, profile.userId)),
      db
        .select({
          totalReviews: sql<number>`count(*)`,
        })
        .from(userReview)
        .where(eq(userReview.userId, profile.userId)),
      db
        .select({
          albumId: userRating.albumId,
          rating: userRating.rating,
          updatedAt: userRating.updatedAt,
        })
        .from(userRating)
        .where(eq(userRating.userId, profile.userId))
        .orderBy(desc(userRating.updatedAt))
        .limit(12),
      db
        .select({
          albumId: userReview.albumId,
          content: userReview.content,
          albumName: userReview.albumName,
          albumCover: userReview.albumCover,
          albumArtists: userReview.albumArtists,
          createdAt: userReview.createdAt,
        })
        .from(userReview)
        .where(eq(userReview.userId, profile.userId))
        .orderBy(desc(userReview.createdAt))
        .limit(10),
      db.select().from(userList).where(eq(userList.userId, profile.userId)),
      db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followingId, profile.userId)),
      db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followerId, profile.userId)),
    ])

    const ratingSummary = ratingSummaryRows[0]
    const reviewSummary = reviewSummaryRows[0]
    const followerCount = Number(followerCountRows[0]?.count ?? 0)
    const followingCount = Number(followingCountRows[0]?.count ?? 0)

    // Get list albums for display
    const listIds = lists.map((l) => l.id)
    const listAlbums = listIds.length
      ? await db.select().from(userListAlbum).where(inArray(userListAlbum.listId, listIds))
      : []

    const albumsByList = new Map<string, typeof listAlbums>()
    listAlbums.forEach((entry) => {
      const group = albumsByList.get(entry.listId) ?? []
      group.push(entry)
      albumsByList.set(entry.listId, group)
    })

    const releasePreviewMap = await getReleasePreviewMap([
      ...recentRatingsRows.map((rating) => rating.albumId),
      ...listAlbums.map((album) => album.albumId),
    ])

    // Check if the requesting user is following this profile
    let isFollowing = false
    if (authUser?.id && authUser.id !== profile.userId) {
      const followRow = await db
        .select({ id: userFollow.id })
        .from(userFollow)
        .where(and(eq(userFollow.followerId, authUser.id), eq(userFollow.followingId, profile.userId)))
        .limit(1)
      isFollowing = Boolean(followRow[0])
    }

    // Recent ratings (last 12)
    const recentRatings = recentRatingsRows.map((r) => {
        const preview = releasePreviewMap.get(r.albumId)
        return {
          albumId: r.albumId,
          rating: r.rating,
          timestamp: r.updatedAt.getTime(),
          albumName: preview?.name ?? '',
          albumCover: preview?.cover ?? '',
        }
      })

    // Recent reviews (last 10)
    const recentReviews = recentReviewsRows.map((r) => ({
        albumId: r.albumId,
        content: r.content,
        albumName: r.albumName,
        albumCover: r.albumCover,
        albumArtists: r.albumArtists,
        createdAt: r.createdAt.getTime(),
      }))

    // Public lists
    const publicLists = [...lists]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((list) => {
        const albums = (albumsByList.get(list.id) ?? [])
          .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
          .slice(0, 6)
          .map((a) => {
            const preview = releasePreviewMap.get(a.albumId)
            return {
              id: a.albumId,
              name: preview?.name || a.name,
              cover: preview?.cover || a.cover,
              artists: preview?.artists?.length ? preview.artists : Array.isArray(a.artists) ? a.artists : [],
            }
          })
        return {
          id: list.id,
          name: list.name,
          albumCount: albumsByList.get(list.id)?.length ?? 0,
          albums,
          createdAt: list.createdAt.getTime(),
        }
      })

    // Compute average rating
    const avgRating = Number(ratingSummary?.averageRating ?? 0)
    const totalRated = Number(ratingSummary?.totalRated ?? 0)
    const totalReviews = Number(reviewSummary?.totalReviews ?? 0)

    set.headers ??= {}
    set.headers['Cache-Control'] = 'public, max-age=30'
    return {
      data: {
        userId: profile.userId,
        name: targetUser.name,
        username: profile.username,
        bio: profile.bio,
        isPrivate: false,
        joinedAt: targetUser.createdAt.getTime(),
        stats: {
          totalRated,
          averageRating: Math.round(avgRating * 10) / 10,
          totalReviews,
          totalLists: lists.length,
        },
        followerCount,
        followingCount,
        isFollowing,
        isOwnProfile: authUser?.id === profile.userId,
        recentRatings,
        recentReviews,
        lists: publicLists,
      },
    }
  })

  // ── Follow / Unfollow ──

  .post('/api/users/:username/follow', async ({ request, params, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const username = String(params?.username ?? '').trim().toLowerCase()
    if (!username) {
      set.status = 400
      return { error: 'Missing username.' }
    }

    const profiles = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.username, username))
      .limit(1)

    const targetProfile = profiles[0]
    if (!targetProfile) {
      set.status = 404
      return { error: 'User not found.' }
    }

    if (targetProfile.userId === authUser.id) {
      set.status = 400
      return { error: 'Cannot follow yourself.' }
    }

    // Check if already following
    const existing = await db
      .select({ id: userFollow.id })
      .from(userFollow)
      .where(and(eq(userFollow.followerId, authUser.id), eq(userFollow.followingId, targetProfile.userId)))
      .limit(1)

    const now = new Date()

    if (existing[0]) {
      // Unfollow
      await db.delete(userFollow).where(eq(userFollow.id, existing[0].id))
      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return { data: { following: false } }
    }

    // Follow
    await db.insert(userFollow).values({
      id: crypto.randomUUID(),
      followerId: authUser.id,
      followingId: targetProfile.userId,
      createdAt: now,
    })

    recordActivity({
      userId: authUser.id,
      type: 'followed',
      targetUserId: targetProfile.userId,
      metadata: { targetUsername: username },
    })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data: { following: true } }
  })

  // ── Following / Followers lists ──

  .get('/api/me/following', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const follows = await db
      .select({
        followingId: userFollow.followingId,
        createdAt: userFollow.createdAt,
      })
      .from(userFollow)
      .where(eq(userFollow.followerId, authUser.id))

    if (!follows.length) return { data: [] }

    const followingIds = follows.map((f) => f.followingId)
    const [users, profiles] = await Promise.all([
      db.select().from(user).where(inArray(user.id, followingIds)),
      db.select().from(userProfile).where(inArray(userProfile.userId, followingIds)),
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))
    const profileMap = new Map(profiles.map((p) => [p.userId, p]))

    const data = follows
      .map((f) => {
        const u = userMap.get(f.followingId)
        const p = profileMap.get(f.followingId)
        if (!u) return null
        return {
          userId: u.id,
          name: u.name,
          username: p?.username ?? null,
          image: u.image ?? null,
          followedAt: f.createdAt.getTime(),
        }
      })
      .filter(Boolean)

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data }
  })
  .get('/api/me/followers', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const follows = await db
      .select({
        followerId: userFollow.followerId,
        createdAt: userFollow.createdAt,
      })
      .from(userFollow)
      .where(eq(userFollow.followingId, authUser.id))

    if (!follows.length) return { data: [] }

    const followerIds = follows.map((f) => f.followerId)
    const [users, profiles] = await Promise.all([
      db.select().from(user).where(inArray(user.id, followerIds)),
      db.select().from(userProfile).where(inArray(userProfile.userId, followerIds)),
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))
    const profileMap = new Map(profiles.map((p) => [p.userId, p]))

    const data = follows
      .map((f) => {
        const u = userMap.get(f.followerId)
        const p = profileMap.get(f.followerId)
        if (!u) return null
        return {
          userId: u.id,
          name: u.name,
          username: p?.username ?? null,
          image: u.image ?? null,
          followedAt: f.createdAt.getTime(),
        }
      })
      .filter(Boolean)

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data }
  })

  // ── Activity Feed ──

  .get('/api/me/feed', async ({ request, query, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const limitParam = Number(query?.limit)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20

    // Get list of people I follow
    const follows = await db
      .select({ followingId: userFollow.followingId })
      .from(userFollow)
      .where(eq(userFollow.followerId, authUser.id))

    // Include the user's own activity + followed users' activity
    const feedUserIds = [authUser.id, ...follows.map((f) => f.followingId)]

    // Cursor-based pagination
    const cursor = query?.cursor ? new Date(String(query.cursor)) : null
    const conditions = [inArray(activity.userId, feedUserIds)]
    if (cursor && !isNaN(cursor.getTime())) {
      conditions.push(lt(activity.createdAt, cursor))
    }

    const items = await db
      .select()
      .from(activity)
      .where(and(...conditions))
      .orderBy(desc(activity.createdAt))
      .limit(limit + 1)

    const hasMore = items.length > limit
    const pageItems = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.createdAt.toISOString() : null

    // Enrich with user names
    const actorIds = [...new Set(pageItems.map((i) => i.userId))]
    const targetIds = [...new Set(pageItems.map((i) => i.targetUserId).filter(Boolean))] as string[]
    const allUserIds = [...new Set([...actorIds, ...targetIds])]

    const [users, profiles] = await Promise.all([
      allUserIds.length ? db.select().from(user).where(inArray(user.id, allUserIds)) : [],
      allUserIds.length ? db.select().from(userProfile).where(inArray(userProfile.userId, allUserIds)) : [],
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))
    const profileMap = new Map(profiles.map((p) => [p.userId, p]))

    const data = pageItems.map((item) => {
      const actor = userMap.get(item.userId)
      const actorProfile = profileMap.get(item.userId)
      const target = item.targetUserId ? userMap.get(item.targetUserId) : null
      const targetProfile = item.targetUserId ? profileMap.get(item.targetUserId) : null

      return {
        id: item.id,
        type: item.type,
        user: {
          id: item.userId,
          name: actor?.name ?? 'Unknown',
          username: actorProfile?.username ?? null,
          image: actor?.image ?? null,
        },
        albumId: item.albumId,
        albumName: item.albumName,
        albumCover: item.albumCover,
        targetUser: target
          ? {
              id: target.id,
              name: target.name,
              username: targetProfile?.username ?? null,
              image: target.image ?? null,
            }
          : null,
        metadata: item.metadata,
        createdAt: item.createdAt.getTime(),
      }
    })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data, nextCursor }
  })

  // ── Reviews ──

  .put('/api/me/reviews/:albumId', async ({ request, params, body, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const albumId = String(params?.albumId ?? '').trim()
    if (!albumId) {
      set.status = 400
      return { error: 'Missing album id.' }
    }

    const typed = body as {
      content?: unknown
      albumName?: unknown
      albumCover?: unknown
      albumArtists?: unknown
    }

    const content = String(typed.content ?? '').trim().slice(0, MAX_REVIEW_LENGTH)
    if (!content) {
      set.status = 400
      return { error: 'Review content is required.' }
    }

    const albumMeta = await getCanonicalAlbumMetadata(albumId, {
      name: typed.albumName,
      cover: typed.albumCover,
      artists: typed.albumArtists,
    })

    const now = new Date()
    await db
      .insert(userReview)
      .values({
        id: crypto.randomUUID(),
        userId: authUser.id,
        albumId,
        content,
        albumName: albumMeta.name,
        albumCover: albumMeta.cover,
        albumArtists: albumMeta.artists,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userReview.userId, userReview.albumId],
        set: {
          content,
          albumName: albumMeta.name,
          albumCover: albumMeta.cover,
          albumArtists: albumMeta.artists,
          updatedAt: now,
        },
      })

    recordActivity({
      userId: authUser.id,
      type: 'reviewed',
      albumId,
      albumName: albumMeta.name || null,
      albumCover: albumMeta.cover || null,
      metadata: { snippet: content.slice(0, 100) },
    })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        albumId,
        content,
        updatedAt: now.getTime(),
      },
    }
  })
  .delete('/api/me/reviews/:albumId', async ({ request, params, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const albumId = String(params?.albumId ?? '').trim()
    if (!albumId) {
      set.status = 400
      return { error: 'Missing album id.' }
    }

    await db
      .delete(userReview)
      .where(and(eq(userReview.userId, authUser.id), eq(userReview.albumId, albumId)))

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data: { deleted: true } }
  })
  .get('/api/me/reviews', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const reviews = await db
      .select()
      .from(userReview)
      .where(eq(userReview.userId, authUser.id))
      .orderBy(desc(userReview.updatedAt))

    const data = reviews.map((r) => ({
      albumId: r.albumId,
      content: r.content,
      albumName: r.albumName,
      albumCover: r.albumCover,
      albumArtists: r.albumArtists,
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
    }))

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data }
  })

  // Public album reviews
  .get('/api/albums/:albumId/reviews', async ({ params, query, set }) => {
    const albumId = String(params?.albumId ?? '').trim()
    if (!albumId) {
      set.status = 400
      return { error: 'Missing album id.' }
    }

    const limitParam = Number(query?.limit)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10
    const cursor = query?.cursor ? new Date(String(query.cursor)) : null

    const conditions = [eq(userReview.albumId, albumId)]
    if (cursor && !isNaN(cursor.getTime())) {
      conditions.push(lt(userReview.createdAt, cursor))
    }

    const reviews = await db
      .select()
      .from(userReview)
      .where(and(...conditions))
      .orderBy(desc(userReview.createdAt))
      .limit(limit + 1)

    const hasMore = reviews.length > limit
    const pageReviews = hasMore ? reviews.slice(0, limit) : reviews
    const nextCursor = hasMore ? pageReviews[pageReviews.length - 1]?.createdAt.toISOString() : null

    // Enrich with user info
    const reviewerIds = [...new Set(pageReviews.map((r) => r.userId))]
    const [users, profiles, ratings] = await Promise.all([
      reviewerIds.length ? db.select().from(user).where(inArray(user.id, reviewerIds)) : [],
      reviewerIds.length ? db.select().from(userProfile).where(inArray(userProfile.userId, reviewerIds)) : [],
      reviewerIds.length
        ? db
            .select()
            .from(userRating)
            .where(and(inArray(userRating.userId, reviewerIds), eq(userRating.albumId, albumId)))
        : [],
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))
    const profileMap = new Map(profiles.map((p) => [p.userId, p]))
    const ratingMap = new Map(ratings.map((r) => [r.userId, r.rating]))

    const data = pageReviews
      .filter((r) => {
        // Only include reviews from users with public profiles (or who have no profile row = default public)
        const p = profileMap.get(r.userId)
        return !p || p.isPublic
      })
      .map((r) => {
        const u = userMap.get(r.userId)
        const p = profileMap.get(r.userId)
        return {
          id: r.id,
          content: r.content,
          user: {
            id: r.userId,
            name: u?.name ?? 'Unknown',
            username: p?.username ?? null,
          },
          rating: ratingMap.get(r.userId) ?? null,
          createdAt: r.createdAt.getTime(),
        }
      })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'public, max-age=30'
    return { data, nextCursor }
  })

  // ── Public list view ──

  .get('/api/lists/:listId', async ({ params, set }) => {
    const listId = String(params?.listId ?? '').trim()
    if (!listId) {
      set.status = 400
      return { error: 'Missing list id.' }
    }

    const lists = await db.select().from(userList).where(eq(userList.id, listId)).limit(1)
    const targetList = lists[0]
    if (!targetList) {
      set.status = 404
      return { error: 'List not found.' }
    }

    // Check if the owner's profile is public
    const ownerProfiles = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, targetList.userId))
      .limit(1)
    const ownerProfile = ownerProfiles[0]
    if (ownerProfile && !ownerProfile.isPublic) {
      set.status = 404
      return { error: 'List not found.' }
    }

    // Fetch owner info
    const owners = await db.select().from(user).where(eq(user.id, targetList.userId)).limit(1)
    const owner = owners[0]

    // Fetch albums
    const albums = await db
      .select()
      .from(userListAlbum)
      .where(eq(userListAlbum.listId, listId))

    const releasePreviewMap = await getReleasePreviewMap(albums.map((album) => album.albumId))

    const sortedAlbums = [...albums]
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
      .map((a) => {
        const preview = releasePreviewMap.get(a.albumId)
        return {
          id: a.albumId,
          name: preview?.name || a.name,
          cover: preview?.cover || a.cover,
          artists: preview?.artists?.length ? preview.artists : Array.isArray(a.artists) ? a.artists : [],
          releaseYear: preview?.releaseYear ?? a.releaseYear,
          addedAt: a.addedAt.getTime(),
        }
      })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'public, max-age=30'
    return {
      data: {
        id: targetList.id,
        name: targetList.name,
        owner: {
          id: targetList.userId,
          name: owner?.name ?? 'Unknown',
          username: ownerProfile?.username ?? null,
        },
        albums: sortedAlbums,
        albumCount: sortedAlbums.length,
        createdAt: targetList.createdAt.getTime(),
        updatedAt: targetList.updatedAt.getTime(),
      },
    }
  })

  // ── User Search ──

  .get('/api/users/search', async ({ request, query, set }) => {
    const q = String(query?.q ?? '').trim()
    if (!q || q.length < 2) {
      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return { data: [], nextCursor: null }
    }

    const limitParam = Number(query?.limit)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 30) : 20
    const pattern = `%${q}%`

    // Cursor-based pagination using offset for simplicity (user search is not time-ordered)
    const offsetParam = Number(query?.offset)
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0

    // Search across username and display name (include both public and private profiles)
    const results = await db
      .select({
        userId: userProfile.userId,
        username: userProfile.username,
        bio: userProfile.bio,
        isPublic: userProfile.isPublic,
        name: user.name,
        image: user.image,
      })
      .from(userProfile)
      .innerJoin(user, eq(userProfile.userId, user.id))
      .where(
        or(
          ilike(userProfile.username, pattern),
          ilike(user.name, pattern),
        ),
      )
      .orderBy(userProfile.username)
      .limit(limit + 1)
      .offset(offset)

    const hasMore = results.length > limit
    const pageResults = hasMore ? results.slice(0, limit) : results
    const nextOffset = hasMore ? offset + limit : null

    // If the requester is logged in, include follow status
    const authUser = await getAuthUser(request)
    let followSet = new Set<string>()
    if (authUser) {
      const userIds = pageResults.map((r) => r.userId)
      if (userIds.length) {
        const follows = await db
          .select({ followingId: userFollow.followingId })
          .from(userFollow)
          .where(and(eq(userFollow.followerId, authUser.id), inArray(userFollow.followingId, userIds)))
        followSet = new Set(follows.map((f) => f.followingId))
      }
    }

    const data = pageResults
      .filter((r) => r.username) // Only return users who have set a username
      .map((r) => ({
        userId: r.userId,
        username: r.username,
        name: r.name,
        image: r.isPublic ? r.image : null, // Don't expose avatar for private profiles
        bio: r.isPublic ? r.bio : null, // Don't expose bio for private profiles
        isPrivate: !r.isPublic,
        isFollowing: authUser ? followSet.has(r.userId) : false,
        isMe: authUser ? r.userId === authUser.id : false,
      }))

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data, nextOffset }
  })

  // ── Existing public routes ──

  .get('/api/cron/home-refresh', async ({ query, request, set }) => {
    const authError = authorizeCron(request, set)
    if (authError) return authError

    try {
      const happeningLimitParam = Number(query?.happeningLimit)
      const recentLimitParam = Number(query?.recentLimit)
      const happeningLimit = Number.isFinite(happeningLimitParam) ? Math.min(Math.max(happeningLimitParam, 1), 50) : 12
      const recentLimit = Number.isFinite(recentLimitParam) ? Math.min(Math.max(recentLimitParam, 1), 50) : 24
      const result = await refreshStoredHomeAlbums({ happeningLimit, recentLimit })
      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return {
        ok: true,
        refreshedAt: new Date().toISOString(),
        mostHappening: {
          insertedOrUpdated: result.mostHappening.insertedOrUpdated,
          snapshotSize: result.mostHappening.data.length,
          refreshedAt: result.mostHappening.refreshedAt.toISOString(),
        },
        recentReleases: {
          insertedOrUpdated: result.recentReleases.insertedOrUpdated,
          snapshotSize: result.recentReleases.data.length,
          refreshedAt: result.recentReleases.refreshedAt.toISOString(),
        },
      }
    } catch (error) {
      if (isStoredTrendingTableMissingError(error)) {
        set.status = 503
        return { error: 'stored_trending_album table is missing. Run the latest database migration first.' }
      }
      console.error('[cron.home-refresh] error', error)
      set.status = 502
      return { error: 'Unable to refresh stored homepage releases right now.' }
    }
  })

  .get('/api/cron/recent-releases-refresh', async ({ query, request, set }) => {
    const authError = authorizeCron(request, set)
    if (authError) return authError

    try {
      const limitParam = Number(query?.limit)
      const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 24
      const result = await refreshStoredTrendingAlbums('recent-popular', limit)
      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return {
        ok: true,
        mode: 'recent-popular',
        insertedOrUpdated: result.insertedOrUpdated,
        snapshotSize: result.data.length,
        refreshedAt: result.refreshedAt.toISOString(),
      }
    } catch (error) {
      if (isStoredTrendingTableMissingError(error)) {
        set.status = 503
        return { error: 'stored_trending_album table is missing. Run the latest database migration first.' }
      }
      console.error('[cron.recent-releases-refresh] error', error)
      set.status = 502
      return { error: 'Unable to refresh stored recent releases right now.' }
    }
  })

  .get('/api/featured', async ({ query, set }) => {
    try {
      const limitParam = Number(query?.limit)
      const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 24
      const mode = String(query?.mode ?? '').toLowerCase()
      const normalizedMode = mode === 'recent-popular' ? 'recent-popular' : 'featured'
      const data = await loadStoredFeaturedSection(normalizedMode, limit)

      set.headers ??= {}
      set.headers['Cache-Control'] = 'public, max-age=60'
      return { data: await attachMusicoCommunityStats(data) }
    } catch (error) {
      console.error('[featured] error', error)
      set.status = 502
      return { error: 'Unable to load featured releases right now.' }
    }
  })
  .get('/api/home', async ({ query, set }) => {
    try {
      const happeningLimitParam = Number(query?.happeningLimit)
      const recentLimitParam = Number(query?.recentLimit)
      const happeningLimit = Number.isFinite(happeningLimitParam) ? Math.min(Math.max(happeningLimitParam, 1), 50) : 24
      const recentLimit = Number.isFinite(recentLimitParam) ? Math.min(Math.max(recentLimitParam, 1), 50) : 24

      const [mostHappening, recentReleases] = await Promise.allSettled([
        loadStoredFeaturedSection('featured', happeningLimit),
        loadStoredFeaturedSection('recent-popular', recentLimit),
      ])

      const mostHappeningData = mostHappening.status === 'fulfilled'
        ? await attachMusicoCommunityStats(mostHappening.value)
        : []
      const recentReleasesData = recentReleases.status === 'fulfilled'
        ? await attachMusicoCommunityStats(recentReleases.value)
        : []

      const allFailed = mostHappening.status === 'rejected' && recentReleases.status === 'rejected'
      if (allFailed) set.status = 502

      set.headers ??= {}
      set.headers['Cache-Control'] = 'public, max-age=60'
      return {
        mostHappening: {
          data: mostHappeningData,
          ...(mostHappening.status === 'rejected'
            ? { error: 'Unable to load most happening albums.' }
            : {}),
        },
        recentReleases: {
          data: recentReleasesData,
          ...(recentReleases.status === 'rejected'
            ? { error: 'Unable to load recent releases.' }
            : {}),
        },
      }
    } catch (error) {
      console.error('[home] error', error)
      set.status = 502
      return { error: 'Unable to load homepage data right now.' }
    }
  })
  .get('/api/search', async ({ query, set }) => {
    const q = (query?.q ?? '').toString()
    if (!q.trim()) {
      set.status = 400
      return { error: 'Missing search query.' }
    }
    try {
      const result = await searchReleases(q)
      const data = await attachMusicoCommunityStats(result.data)
      set.headers ??= {}
      set.headers['Cache-Control'] = 'public, max-age=60'
      return {
        data,
        ...(result.correctedQuery ? { correctedQuery: result.correctedQuery } : {}),
      }
    } catch (error) {
      console.error('[search] error', error)
      set.status = 502
      return { error: 'Search unavailable right now. Please try again shortly.' }
    }
  })
  .post('/api/search-events', async ({ body, set }) => {
    const typedBody = body as { query?: unknown }
    const query = String(typedBody?.query ?? '').trim()
    if (!query) {
      set.status = 400
      return { error: 'Missing search query.' }
    }

    try {
      await recordSearchQuery(query)
      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return { ok: true }
    } catch (error) {
      if (isStoredTrendingTableMissingError(error)) {
        set.status = 503
        return { error: 'Database migration is missing.' }
      }
      console.error('[search-events] error', error)
      set.status = 500
      return { error: 'Unable to record search query right now.' }
    }
  })
  .get('/api/releases/:id', async ({ params, set }) => {
    if (!params?.id) {
      set.status = 400
      return { error: 'Missing release id.' }
    }
    try {
      const data = await getReleaseDetails(params.id)
      const [hydrated] = await attachMusicoCommunityStats([data])
      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
      return hydrated
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

log('info', 'server.started', {
  port: app.server?.port ?? PORT,
  url: env.BETTER_AUTH_URL,
})

const shutdown = async (signal: string) => {
  log('warn', 'server.shutdown_started', { signal })
  try {
    await app.stop()
    log('info', 'server.shutdown_completed', { signal })
    process.exit(0)
  } catch (error) {
    log('error', 'server.shutdown_failed', {
      signal,
      message: error instanceof Error ? error.message : 'Unknown shutdown error',
    })
    process.exit(1)
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
