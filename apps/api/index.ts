import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { and, eq, inArray } from 'drizzle-orm'

import { auth } from './auth'
import { db } from './db'
import { getFeaturedReleases, getRecentPopularReleases, getReleaseDetails, searchReleases } from './discogs'
import { userList, userListAlbum, userRating } from './schema'

const env = ((globalThis as unknown as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env ??
  process.env ??
  {}) as Record<string, string | undefined>

const PORT = Number(env.PORT ?? 4000)

const RATE_LIMIT_WINDOW = 1000 * 60 * 60 // 1 hour
const RATE_LIMIT_MAX = 100
const MAX_LISTS_PER_USER = 30
const MAX_ALBUMS_PER_LIST = 200

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

const allowedOrigin = (env.ALLOWED_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

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

const app = new Elysia()
  .use(
    cors({
      origin: allowedOrigin,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
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
    message: 'MuseVault API proxy is running.',
  }))
  .get('/api/me/ratings', async ({ request, set }) => {
    const user = await ensureAuthenticated(request, set)
    if (!user) return { error: 'Unauthorized.' }

    const rows = await db.select().from(userRating).where(eq(userRating.userId, user.id))
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
    const user = await ensureAuthenticated(request, set)
    if (!user) return { error: 'Unauthorized.' }

    const albumId = String(params?.albumId ?? '').trim()
    const rating = Number((body as { rating?: unknown })?.rating)

    if (!albumId) {
      set.status = 400
      return { error: 'Missing album id.' }
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      set.status = 400
      return { error: 'Rating must be between 1 and 5.' }
    }

    const now = new Date()
    await db
      .insert(userRating)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        albumId,
        rating: Math.round(rating),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userRating.userId, userRating.albumId],
        set: {
          rating: Math.round(rating),
          updatedAt: now,
        },
      })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        rating: Math.round(rating),
        timestamp: now.getTime(),
      },
    }
  })
  .get('/api/me/lists', async ({ request, set }) => {
    const user = await ensureAuthenticated(request, set)
    if (!user) return { error: 'Unauthorized.' }

    const lists = await db.select().from(userList).where(eq(userList.userId, user.id))
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

    const data = [...lists]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((list) => {
        const listAlbums = (albumsByList.get(list.id) ?? [])
          .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
          .map((album) => ({
            id: album.albumId,
            name: album.name,
            cover: album.cover,
            artists: Array.isArray(album.artists) ? album.artists : [],
            releaseYear: album.releaseYear,
            addedAt: album.addedAt.getTime(),
          }))

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
    const user = await ensureAuthenticated(request, set)
    if (!user) return { error: 'Unauthorized.' }

    const name = normalizeListName((body as { name?: unknown })?.name)
    if (!name) {
      set.status = 400
      return { error: 'List name is required.' }
    }

    const currentLists = await db.select().from(userList).where(eq(userList.userId, user.id))
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
      userId: user.id,
      name,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(userList).values(created)

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        id: created.id,
        name: created.name,
        albums: [],
        createdAt: created.createdAt.getTime(),
        updatedAt: created.updatedAt.getTime(),
      },
    }
  })
  .post('/api/me/lists/:listId/toggle', async ({ request, params, body, set }) => {
    const user = await ensureAuthenticated(request, set)
    if (!user) return { error: 'Unauthorized.' }

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
      .where(and(eq(userList.id, listId), eq(userList.userId, user.id)))
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

    const currentCount = await db
      .select({ id: userListAlbum.id })
      .from(userListAlbum)
      .where(eq(userListAlbum.listId, listId))

    if (currentCount.length >= MAX_ALBUMS_PER_LIST) {
      set.status = 400
      return { error: 'This list is full.' }
    }

    await db.insert(userListAlbum).values({
      id: crypto.randomUUID(),
      listId,
      albumId,
      name: String(album?.name ?? 'Untitled').trim() || 'Untitled',
      cover: String(album?.cover ?? '').trim(),
      artists: toSafeArtists(album?.artists),
      releaseYear: parseReleaseYear(album?.releaseYear),
      addedAt: now,
    })
    await db.update(userList).set({ updatedAt: now }).where(eq(userList.id, listId))

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        added: true,
        listName: targetList.name,
      },
    }
  })
  .get('/api/featured', async ({ query, set }) => {
    try {
      const limitParam = Number(query?.limit)
      const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 24
      const mode = String(query?.mode ?? '').toLowerCase()
      const data =
        mode === 'recent-popular'
          ? await getRecentPopularReleases(limit)
          : await getFeaturedReleases(limit)
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
