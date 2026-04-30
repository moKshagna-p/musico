import { Elysia, t } from 'elysia'
import { and, desc, eq, inArray, lt, sql, ilike, or } from 'drizzle-orm'
import { db } from '../core/db'
import {
  user,
  userProfile,
  userRating,
  userReview,
  userList,
  userListAlbum,
  userFollow,
  activity,
} from '../core/schema'
import {
  ensureAuthenticated,
  normalizeRating,
  getCanonicalAlbumMetadata,
  recordActivity,
  ensureUserProfile,
  getCachedReleaseArtists,
  getReleasePreviewMap,
  getCachedReleasePreviewMap,
  parseProfileImage,
  normalizeEmail,
} from '../core/utils'
import { USERNAME_REGEX, MAX_BIO_LENGTH } from '../core/constants'

export const userRoutes = new Elysia({ prefix: '/api' })
  .get('/me/ratings', async ({ request, set }) => {
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
  .get('/me/ratings/history', async ({ request, query, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const limitParam = Number(query?.limit)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 48) : 20
    const cursorParam = Number(query?.cursor)
    const cursor = Number.isFinite(cursorParam) ? new Date(cursorParam) : null

    const conditions = [eq(userRating.userId, authUser.id)]
    if (cursor && !Number.isNaN(cursor.getTime())) {
      conditions.push(lt(userRating.updatedAt, cursor))
    }

    const rows = await db
      .select({
        albumId: userRating.albumId,
        rating: userRating.rating,
        updatedAt: userRating.updatedAt,
      })
      .from(userRating)
      .where(and(...conditions))
      .orderBy(desc(userRating.updatedAt))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.updatedAt.getTime() : null
    const pageAlbumIds = [...new Set(pageRows.map((entry) => entry.albumId).filter(Boolean))]

    const [ratingActivityRows, reviewRows, listRows, releaseCacheRows] = pageAlbumIds.length
      ? await Promise.all([
          db
            .select({
              albumId: activity.albumId,
              albumName: activity.albumName,
              albumCover: activity.albumCover,
              createdAt: activity.createdAt,
            })
            .from(activity)
            .where(
              and(
                eq(activity.userId, authUser.id),
                eq(activity.type, 'rated'),
                inArray(activity.albumId, pageAlbumIds),
              ),
            )
            .orderBy(desc(activity.createdAt))
            .limit(150),
          db
            .select({
              albumId: userReview.albumId,
              albumName: userReview.albumName,
              albumCover: userReview.albumCover,
              albumArtists: userReview.albumArtists,
              updatedAt: userReview.updatedAt,
            })
            .from(userReview)
            .where(and(eq(userReview.userId, authUser.id), inArray(userReview.albumId, pageAlbumIds)))
            .orderBy(desc(userReview.updatedAt))
            .limit(120),
          db
            .select({
              albumId: userListAlbum.albumId,
              albumName: userListAlbum.name,
              albumCover: userListAlbum.cover,
              albumArtists: userListAlbum.artists,
              addedAt: userListAlbum.addedAt,
            })
            .from(userListAlbum)
            .innerJoin(userList, eq(userList.id, userListAlbum.listId))
            .where(and(eq(userList.userId, authUser.id), inArray(userListAlbum.albumId, pageAlbumIds)))
            .orderBy(desc(userListAlbum.addedAt))
            .limit(150),
          db
            .select({
              albumId: releaseCache.releaseId,
              payload: releaseCache.payload,
            })
            .from(releaseCache)
            .where(inArray(releaseCache.releaseId, pageAlbumIds)),
        ])
      : [[], [], [], []]

    const ratingActivityByAlbum = new Map<string, { albumName: string; albumCover: string }>()
    for (const row of ratingActivityRows) {
      const albumId = String(row.albumId ?? '').trim()
      if (!albumId || ratingActivityByAlbum.has(albumId)) continue
      ratingActivityByAlbum.set(albumId, {
        albumName: String(row.albumName ?? '').trim(),
        albumCover: String(row.albumCover ?? '').trim(),
      })
    }

    const reviewByAlbum = new Map<string, { albumName: string; albumCover: string; albumArtists: string[] }>()
    for (const row of reviewRows) {
      const albumId = String(row.albumId ?? '').trim()
      if (!albumId || reviewByAlbum.has(albumId)) continue
      reviewByAlbum.set(albumId, {
        albumName: String(row.albumName ?? '').trim(),
        albumCover: String(row.albumCover ?? '').trim(),
        albumArtists: Array.isArray(row.albumArtists) ? row.albumArtists.filter(Boolean).map(String) : [],
      })
    }

    const listByAlbum = new Map<string, { albumName: string; albumCover: string; albumArtists: string[] }>()
    for (const row of listRows) {
      const albumId = String(row.albumId ?? '').trim()
      if (!albumId || listByAlbum.has(albumId)) continue
      listByAlbum.set(albumId, {
        albumName: String(row.albumName ?? '').trim(),
        albumCover: String(row.albumCover ?? '').trim(),
        albumArtists: Array.isArray(row.albumArtists) ? row.albumArtists.filter(Boolean).map(String) : [],
      })
    }

    const cachedArtistsByAlbum = new Map<string, string[]>()
    for (const row of releaseCacheRows) {
      const albumId = String(row.albumId ?? '').trim()
      if (!albumId || cachedArtistsByAlbum.has(albumId)) continue
      const artists = getCachedReleaseArtists(row.payload)
      if (!artists.length) continue
      cachedArtistsByAlbum.set(albumId, artists)
    }

    const missingArtistsAlbumIds = pageAlbumIds.filter((albumId) => {
      if (reviewByAlbum.get(albumId)?.albumArtists?.length) return false
      if (listByAlbum.get(albumId)?.albumArtists?.length) return false
      if (cachedArtistsByAlbum.get(albumId)?.length) return false
      return true
    })

    const previewByAlbum = missingArtistsAlbumIds.length ? await getReleasePreviewMap(missingArtistsAlbumIds) : new Map()

    const data = pageRows.map((row) => {
      const albumId = String(row.albumId ?? '').trim()
      const fromActivity = ratingActivityByAlbum.get(albumId)
      const fromReview = reviewByAlbum.get(albumId)
      const fromList = listByAlbum.get(albumId)
      const cachedArtists = cachedArtistsByAlbum.get(albumId) ?? []
      const preview = previewByAlbum.get(albumId)
      return {
        albumId,
        rating: row.rating,
        timestamp: row.updatedAt.getTime(),
        albumName: fromActivity?.albumName || fromReview?.albumName || fromList?.albumName || preview?.name || '',
        albumCover: fromActivity?.albumCover || fromReview?.albumCover || fromList?.albumCover || preview?.cover || '',
        albumArtists:
          fromReview?.albumArtists?.length
            ? fromReview.albumArtists
            : fromList?.albumArtists?.length
              ? fromList.albumArtists
              : cachedArtists.length
                ? cachedArtists
                : (preview?.artists ?? []),
      }
    })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data,
      nextCursor,
    }
  })
  .put('/me/ratings/:albumId', async ({ request, params, body, set }) => {
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
  .delete('/me/ratings/:albumId', async ({ request, params, set }) => {
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
  .get('/me/profile', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const profile = await ensureUserProfile(authUser.id)

    const [followerCountRows, followingCountRows, ratingSummaryRows, recentRatingsRows, ratingActivityRows, recentReviewMetaRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followingId, authUser.id)),
      db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followerId, authUser.id)),
      db
        .select({
          totalRated: sql<number>`count(*)`,
          averageRating: sql<number>`coalesce(avg(${userRating.rating}), 0)`,
        })
        .from(userRating)
        .where(eq(userRating.userId, authUser.id)),
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
      db
        .select({
          albumId: userReview.albumId,
          albumName: userReview.albumName,
          albumCover: userReview.albumCover,
        })
        .from(userReview)
        .where(eq(userReview.userId, authUser.id))
        .orderBy(desc(userReview.updatedAt))
        .limit(50),
    ])

    const followerCount = Number(followerCountRows[0]?.count ?? 0)
    const followingCount = Number(followingCountRows[0]?.count ?? 0)
    const ratingSummary = ratingSummaryRows[0]

    const latestActivityByAlbum = new Map<string, { albumName: string | null; albumCover: string | null }>()
    for (const row of ratingActivityRows) {
      const albumId = String(row.albumId ?? '').trim()
      if (!albumId || latestActivityByAlbum.has(albumId)) continue
      latestActivityByAlbum.set(albumId, {
        albumName: row.albumName ? String(row.albumName) : null,
        albumCover: row.albumCover ? String(row.albumCover) : null,
      })
    }

    const latestReviewByAlbum = new Map<string, { albumName: string | null; albumCover: string | null }>()
    for (const row of recentReviewMetaRows) {
      const albumId = String(row.albumId ?? '').trim()
      if (!albumId || latestReviewByAlbum.has(albumId)) continue
      latestReviewByAlbum.set(albumId, {
        albumName: row.albumName ? String(row.albumName) : null,
        albumCover: row.albumCover ? String(row.albumCover) : null,
      })
    }

    const recentRatingAlbumIds = recentRatingsRows.map((row) => row.albumId)
    const releasePreviewMap = await getCachedReleasePreviewMap(recentRatingAlbumIds)
    const missingPreviewAlbumIds = recentRatingAlbumIds.filter((albumId) => !releasePreviewMap.has(String(albumId)))
    if (missingPreviewAlbumIds.length) {
      void getReleasePreviewMap(missingPreviewAlbumIds).catch(() => {
        // Missing cache entries should not slow down the profile response.
      })
    }

    const recentRatings = recentRatingsRows.map((row) => {
      const activityMeta = latestActivityByAlbum.get(String(row.albumId))
      const reviewMeta = latestReviewByAlbum.get(String(row.albumId))
      const releaseMeta = releasePreviewMap.get(String(row.albumId))
      return {
        albumId: row.albumId,
        rating: row.rating,
        timestamp: row.updatedAt.getTime(),
        albumName: activityMeta?.albumName || reviewMeta?.albumName || releaseMeta?.name || '',
        albumCover: activityMeta?.albumCover || reviewMeta?.albumCover || releaseMeta?.cover || '',
        albumArtists: releaseMeta?.artists ?? [],
        genres: releaseMeta?.genres ?? [],
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
        stats: {
          totalRated: Number(ratingSummary?.totalRated ?? 0),
          averageRating: Math.round(Number(ratingSummary?.averageRating ?? 0) * 10) / 10,
        },
        recentRatings,
      },
    }
  })
  .put('/me/profile', async ({ request, body, set }) => {
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
  .get('/username/check', async ({ query, set }) => {
    const username = String(query?.username ?? '').trim().toLowerCase()
    if (!username || !USERNAME_REGEX.test(username)) {
      return { data: { available: false, valid: false } }
    }

    const existing = await db
      .select({ userId: userProfile.userId })
      .from(userProfile)
      .where(eq(userProfile.username, username))
      .limit(1)

    return {
      data: {
        available: !existing[0],
        valid: true,
      },
    }
  })
  .get('/users/search', async ({ request, query, set }) => {
    const q = String(query?.q ?? '').trim()
    if (!q || q.length < 2) {
      return { data: [] }
    }

    const limitParam = Number(query?.limit)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20

    const results = await db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
        username: userProfile.username,
      })
      .from(user)
      .innerJoin(userProfile, eq(userProfile.userId, user.id))
      .where(
        and(
          eq(userProfile.isPublic, true),
          or(
            ilike(userProfile.username, `%${q}%`),
            ilike(user.name, `%${q}%`),
          ),
        ),
      )
      .limit(limit)

    return {
      data: results.map((row) => ({
        id: row.id,
        name: row.name,
        username: row.username,
        image: row.image,
      })),
    }
  })
  .get('/users/:username', async ({ params, request, set }) => {
    const username = String(params?.username ?? '').trim().toLowerCase()
    if (!username) {
      set.status = 400
      return { error: 'Username is required.' }
    }

    const profiles = await db
      .select({
        userId: userProfile.userId,
        username: userProfile.username,
        bio: userProfile.bio,
        isPublic: userProfile.isPublic,
        name: user.name,
        image: user.image,
      })
      .from(userProfile)
      .innerJoin(user, eq(user.id, userProfile.userId))
      .where(eq(userProfile.username, username))
      .limit(1)

    const profile = profiles[0]
    if (!profile) {
      set.status = 404
      return { error: 'User not found.' }
    }

    const authUser = await getAuthUser(request)
    const isOwnProfile = authUser?.id === profile.userId

    if (!profile.isPublic && !isOwnProfile) {
      set.status = 403
      return { error: 'This profile is private.' }
    }

    const [followerCountRows, followingCountRows, isFollowingRows, ratingSummaryRows, recentRatingsRows, listsRows, ratingActivityRows, recentReviewMetaRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followingId, profile.userId)),
      db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followerId, profile.userId)),
      authUser?.id
        ? db
            .select({ id: userFollow.id })
            .from(userFollow)
            .where(and(eq(userFollow.followerId, authUser.id), eq(userFollow.followingId, profile.userId)))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({
          totalRated: sql<number>`count(*)`,
          averageRating: sql<number>`coalesce(avg(${userRating.rating}), 0)`,
        })
        .from(userRating)
        .where(eq(userRating.userId, profile.userId)),
      db
        .select({
          albumId: userRating.albumId,
          rating: userRating.rating,
          updatedAt: userRating.updatedAt,
        })
        .from(userRating)
        .where(eq(userRating.userId, profile.userId))
        .orderBy(desc(userRating.updatedAt))
        .limit(10),
      db
        .select({
          id: userList.id,
          name: userList.name,
          updatedAt: userList.updatedAt,
        })
        .from(userList)
        .where(eq(userList.userId, profile.userId))
        .orderBy(desc(userList.updatedAt)),
      db
        .select({
          albumId: activity.albumId,
          albumName: activity.albumName,
          albumCover: activity.albumCover,
          createdAt: activity.createdAt,
        })
        .from(activity)
        .where(and(eq(activity.userId, profile.userId), eq(activity.type, 'rated')))
        .orderBy(desc(activity.createdAt))
        .limit(50),
      db
        .select({
          albumId: userReview.albumId,
          albumName: userReview.albumName,
          albumCover: userReview.albumCover,
        })
        .from(userReview)
        .where(eq(userReview.userId, profile.userId))
        .orderBy(desc(userReview.updatedAt))
        .limit(50),
    ])

    const listIds = listsRows.map((l) => l.id)
    const listAlbumsRows = listIds.length
      ? await db.select().from(userListAlbum).where(inArray(userListAlbum.listId, listIds))
      : []

    const albumsByList = new Map<string, typeof listAlbumsRows>()
    listAlbumsRows.forEach((entry) => {
      const group = albumsByList.get(entry.listId) ?? []
      group.push(entry)
      albumsByList.set(entry.listId, group)
    })

    const followerCount = Number(followerCountRows[0]?.count ?? 0)
    const followingCount = Number(followingCountRows[0]?.count ?? 0)
    const isFollowing = Boolean(isFollowingRows[0])
    const ratingSummary = ratingSummaryRows[0]

    const latestActivityByAlbum = new Map<string, { albumName: string | null; albumCover: string | null }>()
    for (const row of ratingActivityRows) {
      const albumId = row.albumId
      if (!albumId || latestActivityByAlbum.has(albumId)) continue
      latestActivityByAlbum.set(albumId, {
        albumName: row.albumName ? String(row.albumName) : null,
        albumCover: row.albumCover ? String(row.albumCover) : null,
      })
    }

    const latestReviewByAlbum = new Map<string, { albumName: string | null; albumCover: string | null }>()
    for (const row of recentReviewMetaRows) {
      const albumId = row.albumId
      if (!albumId || latestReviewByAlbum.has(albumId)) continue
      latestReviewByAlbum.set(albumId, {
        albumName: row.albumName ? String(row.albumName) : null,
        albumCover: row.albumCover ? String(row.albumCover) : null,
      })
    }

    const recentRatingAlbumIds = recentRatingsRows.map((row) => row.albumId)
    const releasePreviewMap = await getCachedReleasePreviewMap(recentRatingAlbumIds)

    const recentRatings = recentRatingsRows.map((row) => {
      const activityMeta = latestActivityByAlbum.get(row.albumId)
      const reviewMeta = latestReviewByAlbum.get(row.albumId)
      const releaseMeta = releasePreviewMap.get(row.albumId)
      return {
        albumId: row.albumId,
        rating: row.rating,
        timestamp: row.updatedAt.getTime(),
        albumName: activityMeta?.albumName || reviewMeta?.albumName || releaseMeta?.name || '',
        albumCover: activityMeta?.albumCover || reviewMeta?.albumCover || releaseMeta?.cover || '',
        albumArtists: releaseMeta?.artists ?? [],
        genres: releaseMeta?.genres ?? [],
      }
    })

    const lists = listsRows.map((list) => {
      const albums = (albumsByList.get(list.id) ?? [])
        .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
        .map((a) => ({
          id: a.albumId,
          name: a.name,
          cover: a.cover,
          artists: Array.isArray(a.artists) ? a.artists : [],
          releaseYear: a.releaseYear,
        }))

      return {
        id: list.id,
        name: list.name,
        albums: albums.slice(0, 4),
        albumCount: albumsByList.get(list.id)?.length ?? 0,
        updatedAt: list.updatedAt.getTime(),
      }
    })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        id: profile.userId,
        username: profile.username,
        name: profile.name,
        bio: profile.bio,
        image: profile.image,
        isOwnProfile,
        isFollowing,
        followerCount,
        followingCount,
        stats: {
          totalRated: Number(ratingSummary?.totalRated ?? 0),
          averageRating: Math.round(Number(ratingSummary?.averageRating ?? 0) * 10) / 10,
        },
        recentRatings,
        lists,
      },
    }
  })
  .post('/users/:username/follow', async ({ request, params, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const username = String(params?.username ?? '').trim().toLowerCase()
    if (!username) {
      set.status = 400
      return { error: 'Username is required.' }
    }

    const targets = await db
      .select({ userId: userProfile.userId })
      .from(userProfile)
      .where(eq(userProfile.username, username))
      .limit(1)

    const target = targets[0]
    if (!target) {
      set.status = 404
      return { error: 'User not found.' }
    }

    if (target.userId === authUser.id) {
      set.status = 400
      return { error: 'You cannot follow yourself.' }
    }

    const existing = await db
      .select({ id: userFollow.id })
      .from(userFollow)
      .where(and(eq(userFollow.followerId, authUser.id), eq(userFollow.followingId, target.userId)))
      .limit(1)

    if (existing[0]) {
      await db.delete(userFollow).where(eq(userFollow.id, existing[0].id))
      return { data: { following: false } }
    }

    await db.insert(userFollow).values({
      id: crypto.randomUUID(),
      followerId: authUser.id,
      followingId: target.userId,
      createdAt: new Date(),
    })

    // Record activity
    recordActivity({
      userId: authUser.id,
      type: 'followed',
      targetUserId: target.userId,
    })

    return { data: { following: true } }
  })
  .get('/me/following', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const following = await db.select().from(userFollow).where(eq(userFollow.followerId, authUser.id))
    if (!following.length) return { data: [] }

    const followingIds = following.map((f) => f.followingId)
    const [users, profiles] = await Promise.all([
      db.select().from(user).where(inArray(user.id, followingIds)),
      db.select().from(userProfile).where(inArray(userProfile.userId, followingIds)),
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))
    const profileMap = new Map(profiles.map((p) => [p.userId, p]))

    const data = following.map((f) => {
      const u = userMap.get(f.followingId)
      const p = profileMap.get(f.followingId)
      return {
        id: f.followingId,
        username: p?.username ?? null,
        name: u?.name ?? null,
        image: u?.image ?? null,
      }
    })

    return { data }
  })
  .get('/me/followers', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const followers = await db.select().from(userFollow).where(eq(userFollow.followingId, authUser.id))
    if (!followers.length) return { data: [] }

    const followerIds = followers.map((f) => f.followerId)
    const [users, profiles] = await Promise.all([
      db.select().from(user).where(inArray(user.id, followerIds)),
      db.select().from(userProfile).where(inArray(userProfile.userId, followerIds)),
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))
    const profileMap = new Map(profiles.map((p) => [p.userId, p]))

    const data = followers.map((f) => {
      const u = userMap.get(f.followerId)
      const p = profileMap.get(f.followerId)
      return {
       id: f.followerId,
         username: p?.username ?? null,
         name: u?.name ?? null,
         image: u?.image ?? null,
       }
     })

     return { data }
   })
   .get('/me/dashboard', async ({ request, set }) => {
     // Batched endpoint that combines /me/ratings, /me/lists, and /me/profile in a single call
     // Reduces initial load from 3 HTTP requests to 1
     const authUser = await ensureAuthenticated(request, set)
     if (!authUser) return { error: 'Unauthorized.' }

     try {
       const profile = await ensureUserProfile(authUser.id)

       // Fetch all data in parallel
       const [
         ratingsRows,
         ratingSummaryRows,
         recentRatingsRows,
         ratingActivityRows,
         recentReviewMetaRows,
         followerCountRows,
         followingCountRows,
         listsRows,
       ] = await Promise.all([
         // Ratings
         db.select().from(userRating).where(eq(userRating.userId, authUser.id)),
         // Rating summary
         db
           .select({
             totalRated: sql<number>`count(*)`,
             averageRating: sql<number>`coalesce(avg(${userRating.rating}), 0)`,
           })
           .from(userRating)
           .where(eq(userRating.userId, authUser.id)),
         // Recent ratings (for display)
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
         // Rating activity metadata
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
         // Review metadata
         db
           .select({
             albumId: userReview.albumId,
             albumName: userReview.albumName,
             albumCover: userReview.albumCover,
           })
           .from(userReview)
           .where(eq(userReview.userId, authUser.id))
           .orderBy(desc(userReview.updatedAt))
           .limit(50),
         // Follower count
         db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followingId, authUser.id)),
         // Following count
         db.select({ count: sql<number>`count(*)` }).from(userFollow).where(eq(userFollow.followerId, authUser.id)),
         // Lists
         db.select().from(userList).where(eq(userList.userId, authUser.id)),
       ])

       const followerCount = Number(followerCountRows[0]?.count ?? 0)
       const followingCount = Number(followingCountRows[0]?.count ?? 0)
       const ratingSummary = ratingSummaryRows[0]

       // Build ratings map
       const ratingsMap = ratingsRows.reduce(
         (acc, row) => {
           acc[row.albumId] = {
             rating: row.rating,
             timestamp: row.updatedAt.getTime(),
           }
           return acc
         },
         {} as Record<string, { rating: number; timestamp: number }>,
       )

       // Build activity/review metadata maps
       const latestActivityByAlbum = new Map<string, { albumName: string | null; albumCover: string | null }>()
       for (const row of ratingActivityRows) {
         const albumId = String(row.albumId ?? '').trim()
         if (!albumId || latestActivityByAlbum.has(albumId)) continue
         latestActivityByAlbum.set(albumId, {
           albumName: row.albumName ? String(row.albumName) : null,
           albumCover: row.albumCover ? String(row.albumCover) : null,
         })
       }

       const latestReviewByAlbum = new Map<string, { albumName: string | null; albumCover: string | null }>()
       for (const row of recentReviewMetaRows) {
         const albumId = String(row.albumId ?? '').trim()
         if (!albumId || latestReviewByAlbum.has(albumId)) continue
         latestReviewByAlbum.set(albumId, {
           albumName: row.albumName ? String(row.albumName) : null,
           albumCover: row.albumCover ? String(row.albumCover) : null,
         })
       }

       // Get release previews for recent ratings
       const recentRatingAlbumIds = recentRatingsRows.map((row) => row.albumId)
       const releasePreviewMap = await getCachedReleasePreviewMap(recentRatingAlbumIds)

       // Build recent ratings with album details
       const recentRatings = recentRatingsRows.map((row) => {
         const activityMeta = latestActivityByAlbum.get(String(row.albumId))
         const reviewMeta = latestReviewByAlbum.get(String(row.albumId))
         const releaseMeta = releasePreviewMap.get(String(row.albumId))
         return {
           albumId: row.albumId,
           rating: row.rating,
           timestamp: row.updatedAt.getTime(),
           albumName: activityMeta?.albumName || reviewMeta?.albumName || releaseMeta?.name || '',
           albumCover: activityMeta?.albumCover || reviewMeta?.albumCover || releaseMeta?.cover || '',
           albumArtists: releaseMeta?.artists ?? [],
           genres: releaseMeta?.genres ?? [],
         }
       })

       // Process lists
       let lists = []
       if (listsRows.length) {
         const listIds = listsRows.map((entry) => entry.id)
         const listAlbums = await db.select().from(userListAlbum).where(inArray(userListAlbum.listId, listIds))
         const albumsByList = new Map<string, typeof listAlbums>()

         listAlbums.forEach((entry) => {
           const group = albumsByList.get(entry.listId) ?? []
           group.push(entry)
           albumsByList.set(entry.listId, group)
         })

         lists = listsRows
           .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
           .map((list) => {
             const albums = (albumsByList.get(list.id) ?? [])
               .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
               .slice(0, 4)
               .map((album) => ({
                 id: album.albumId,
                 name: album.name,
                 cover: album.cover,
                 artists: album.artists ?? [],
               }))

             return {
               id: list.id,
               name: list.name,
               description: list.description,
               albumCount: list.albumCount,
               albums,
             }
           })
       }

       set.headers ??= {}
       set.headers['Cache-Control'] = 'no-store'
       return {
         ratings: ratingsMap,
         ratingSummary: {
           totalRated: ratingSummary?.totalRated ?? 0,
           averageRating: ratingSummary?.averageRating ?? 0,
         },
         recentRatings,
         profile: {
           id: profile.id,
           userId: profile.userId,
           username: profile.username,
           bio: profile.bio,
           followerCount,
           followingCount,
         },
         lists,
       }
     } catch (error) {
       console.error('[dashboard] error', error)
       set.status = 502
       return { error: 'Unable to load dashboard.' }
     }
   })
