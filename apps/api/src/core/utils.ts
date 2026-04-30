import { sql, eq, inArray } from 'drizzle-orm'
import { db } from './db'
import { auth } from '../auth'
import { env, readOptionalSecret } from './env'
import { getReleaseDetails } from '../services/discogs'
import {
  activity,
  adminUser,
  releaseCache,
  userProfile,
  userRating,
} from './schema'
import {
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX,
  RATE_LIMIT_MAX_TRACKED_IPS,
  MAX_RELEASE_PREVIEW_LOOKUPS,
  BOOTSTRAP_ADMIN_EMAIL,
} from './constants'

export const normalizeRating = (value: number) => {
  if (!Number.isFinite(value)) return null
  const normalized = Math.round(value * 2) / 2
  if (normalized < 0.5 || normalized > 5) return null
  return normalized
}

export const log = (level: 'info' | 'warn' | 'error', message: string, data: Record<string, unknown> = {}) => {
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

export const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? 'unknown'
  const realIp = request.headers.get('x-real-ip') ?? request.headers.get('x-client-ip')
  if (realIp) return realIp
  return request.headers.get('host') ?? 'local'
}

const rateLimiter = new Map<string, { count: number; resetAt: number }>()

export const consumeRateLimit = (ip: string) => {
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

export const normalizeListName = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 48)

export const toSafeArtists = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value.filter(Boolean).map((entry) => String(entry)).slice(0, 3)
}

export const getCachedReleaseArtists = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return []
  const artists = (payload as { artists?: unknown }).artists
  return toSafeArtists(artists)
}

export const parseReleaseYear = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

export const parseProfileImage = (value: unknown) => {
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

export const normalizeAlbumId = (value: unknown) => String(value ?? '').trim()
export const normalizeEmail = (value: unknown) => String(value ?? '').trim().toLowerCase()

export const isMissingAdminTableError = (error: unknown) => {
  const message = String((error as { message?: string })?.message ?? '')
  return message.toLowerCase().includes('relation "admin_user" does not exist')
}

export const getReleasePreviewMap = async (albumIds: unknown[]) => {
  const uniqueAlbumIds = [...new Set(albumIds.map(normalizeAlbumId).filter(Boolean))].slice(0, MAX_RELEASE_PREVIEW_LOOKUPS)
  if (!uniqueAlbumIds.length) {
    return new Map<string, { name: string; cover: string; artists: string[]; genres: string[]; releaseYear: number | null }>()
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
          genres: Array.isArray(details.genres) ? details.genres.filter(Boolean).map(String) : [],
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
          readonly [string, { name: string; cover: string; artists: string[]; genres: string[]; releaseYear: number | null }]
        > => entry.status === 'fulfilled',
      )
      .map((entry) => entry.value),
  )
}

export const getCachedReleasePreviewMap = async (albumIds: unknown[]) => {
  const uniqueAlbumIds = [...new Set(albumIds.map(normalizeAlbumId).filter(Boolean))].slice(0, MAX_RELEASE_PREVIEW_LOOKUPS)
  if (!uniqueAlbumIds.length) {
    return new Map<string, { name: string; cover: string; artists: string[]; genres: string[]; releaseYear: number | null }>()
  }

  const rows = await db
    .select({
      releaseId: releaseCache.releaseId,
      payload: releaseCache.payload,
      expiresAt: releaseCache.expiresAt,
    })
    .from(releaseCache)
    .where(inArray(releaseCache.releaseId, uniqueAlbumIds))

  return new Map(
    rows
      .filter((row) => row.expiresAt instanceof Date && row.expiresAt.getTime() > Date.now())
      .map((row) => {
        const payload = (row.payload ?? {}) as {
          name?: unknown
          cover?: unknown
          artists?: unknown
          genres?: unknown
          releaseYear?: unknown
        }

        return [
          row.releaseId,
          {
            name: String(payload.name ?? '').trim(),
            cover: String(payload.cover ?? '').trim(),
            artists: Array.isArray(payload.artists) ? payload.artists.filter(Boolean).map(String) : [],
            genres: Array.isArray(payload.genres) ? payload.genres.filter(Boolean).map(String) : [],
            releaseYear: Number.isFinite(Number(payload.releaseYear)) ? Number(payload.releaseYear) : null,
          },
        ] as const
      }),
  )
}

export const getCanonicalAlbumMetadata = async (
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

export const getAuthUser = async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user ?? null
}

export const ensureAuthenticated = async (request: Request, set: { status?: number }) => {
  const user = await getAuthUser(request)
  if (!user?.id) {
    set.status = 401
    return null
  }
  return user
}

export const isAdminIdentity = async (identity: { id?: string | null; email?: string | null }) => {
  const userId = String(identity?.id ?? '').trim()
  const email = normalizeEmail(identity?.email)

  if (!userId) return false
  if (email === BOOTSTRAP_ADMIN_EMAIL) return true

  try {
    const rows = await db.select({ userId: adminUser.userId }).from(adminUser).where(eq(adminUser.userId, userId)).limit(1)
    return Boolean(rows[0])
  } catch (error) {
    if (isMissingAdminTableError(error)) {
      return false
    }
    throw error
  }
}

export const ensureAdmin = async (request: Request, set: { status?: number }) => {
  const authUser = await ensureAuthenticated(request, set)
  if (!authUser) return null

  const allowed = await isAdminIdentity({ id: authUser.id, email: authUser.email })
  if (!allowed) {
    set.status = 403
    return null
  }

  return authUser
}

export const authorizeCron = (request: Request, set: { status?: number }) => {
  const cronSecret =
    readOptionalSecret('HOME_REFRESH_SECRET') ??
    readOptionalSecret('CRON_SECRET') ??
    readOptionalSecret('BETTER_AUTH_SECRET')
  if (!cronSecret) {
    set.status = 500
    return { error: 'Cron secret is not configured.' }
  }

  const authorization = request.headers.get('authorization') ?? ''
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  const headerToken = request.headers.get('x-cron-secret')?.trim() ?? ''
  const queryToken = new URL(request.url).searchParams.get('secret')?.trim() ?? ''
  const providedSecret = bearerToken || headerToken || queryToken

  if (providedSecret !== cronSecret) {
    set.status = 401
    return { error: 'Unauthorized cron request.' }
  }

  return null
}

export const attachMusicoCommunityStats = async <T extends { id: string; communityRating?: number; reviewCount?: number }>(
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

export const recordActivity = (params: {
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

export const ensureUserProfile = async (userId: string) => {
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
