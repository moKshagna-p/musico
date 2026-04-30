import { Elysia } from 'elysia'
import { desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '../core/db'
import {
  activity,
  adminUser,
  user,
  userList,
  userProfile,
  userRating,
  userReview,
  userSearchTrend,
} from '../core/schema'
import {
  ensureAdmin,
  ensureAuthenticated,
  isAdminIdentity,
  isMissingAdminTableError,
  normalizeEmail,
  recordActivity,
} from '../core/utils'
import { BOOTSTRAP_ADMIN_EMAIL } from '../core/constants'

export const adminRoutes = new Elysia({ prefix: '/api/admin' })
  .get('/me', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const isAdmin = await isAdminIdentity({ id: authUser.id, email: authUser.email })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        isAdmin,
      },
    }
  })
  .get('/users', async ({ request, query, set }) => {
    const authUser = await ensureAdmin(request, set)
    if (!authUser) return { error: 'Forbidden.' }

    const limitParam = Number(query?.limit)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 25
    const search = String(query?.q ?? '').trim().toLowerCase()

    const searchPattern = search ? `%${search.replace(/[%_]/g, '')}%` : ''

    try {
      const candidateUsers = search
        ? await db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              createdAt: user.createdAt,
            })
            .from(user)
            .where(
              or(
                ilike(user.name, searchPattern),
                ilike(user.email, searchPattern),
              ),
            )
            .orderBy(desc(user.createdAt))
            .limit(Math.max(limit * 3, 60))
        : await db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              createdAt: user.createdAt,
            })
            .from(user)
            .orderBy(desc(user.createdAt))
            .limit(120)

      let mergedCandidates = candidateUsers

      if (search) {
        const profileMatches = await db
          .select({ userId: userProfile.userId })
          .from(userProfile)
          .where(ilike(userProfile.username, searchPattern))
          .limit(Math.max(limit * 2, 40))

        const profileMatchIds = profileMatches.map((entry) => entry.userId)
        if (profileMatchIds.length) {
          const profileUsers = await db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              createdAt: user.createdAt,
            })
            .from(user)
            .where(inArray(user.id, profileMatchIds))

          const byId = new Map<string, (typeof candidateUsers)[number]>()
          candidateUsers.forEach((entry) => byId.set(entry.id, entry))
          profileUsers.forEach((entry) => byId.set(entry.id, entry))
          mergedCandidates = Array.from(byId.values())
        }
      }

      if (!mergedCandidates.length) {
        set.headers ??= {}
        set.headers['Cache-Control'] = 'no-store'
        return { data: [] }
      }

      const candidateUserIds = mergedCandidates.map((entry) => entry.id)
      const [profiles, adminRows] = await Promise.all([
        db
          .select({
            userId: userProfile.userId,
            username: userProfile.username,
          })
          .from(userProfile)
          .where(inArray(userProfile.userId, candidateUserIds)),
        db.select({ userId: adminUser.userId }).from(adminUser),
      ])

      const profileByUserId = new Map(profiles.map((entry) => [entry.userId, entry]))
      const adminUserIds = new Set(adminRows.map((entry) => entry.userId))

      const filtered = mergedCandidates
        .map((entry) => {
          const profile = profileByUserId.get(entry.id)
          const normalizedEmail = normalizeEmail(entry.email)
          const isBootstrapAdmin = normalizedEmail === BOOTSTRAP_ADMIN_EMAIL
          return {
            userId: entry.id,
            name: entry.name,
            email: entry.email,
            username: profile?.username ?? null,
            image: entry.image ?? null,
            createdAt: entry.createdAt.getTime(),
            isAdmin: isBootstrapAdmin || adminUserIds.has(entry.id),
            isBootstrapAdmin,
          }
        })
        .filter((entry) => {
          if (!search) return true
          return (
            entry.name.toLowerCase().includes(search) ||
            entry.email.toLowerCase().includes(search) ||
            String(entry.username ?? '').toLowerCase().includes(search)
          )
        })
        .sort((a, b) => {
          if (a.isAdmin && !b.isAdmin) return -1
          if (!a.isAdmin && b.isAdmin) return 1
          return b.createdAt - a.createdAt
        })
        .slice(0, limit)

      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return { data: filtered }
    } catch (error) {
      if (isMissingAdminTableError(error)) {
        const fallbackUsers = await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            createdAt: user.createdAt,
          })
          .from(user)
          .orderBy(desc(user.createdAt))
          .limit(limit)

        const fallback = fallbackUsers
          .map((entry) => ({
            userId: entry.id,
            name: entry.name,
            email: entry.email,
            username: null,
            image: entry.image ?? null,
            createdAt: entry.createdAt.getTime(),
            isAdmin: normalizeEmail(entry.email) === BOOTSTRAP_ADMIN_EMAIL,
            isBootstrapAdmin: normalizeEmail(entry.email) === BOOTSTRAP_ADMIN_EMAIL,
          }))
          .filter((entry) => {
            if (!search) return true
            return entry.name.toLowerCase().includes(search) || entry.email.toLowerCase().includes(search)
          })

        set.headers ??= {}
        set.headers['Cache-Control'] = 'no-store'
        return { data: fallback }
      }

      throw error
    }
  })
  .put('/users/:userId/admin', async ({ request, params, body, set }) => {
    const authUser = await ensureAdmin(request, set)
    if (!authUser) return { error: 'Forbidden.' }

    const targetUserId = String(params?.userId ?? '').trim()
    const typedBody = body as { isAdmin?: unknown }
    const nextIsAdmin = Boolean(typedBody?.isAdmin)

    if (!targetUserId) {
      set.status = 400
      return { error: 'Missing target user id.' }
    }

    const targetRows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1)

    const target = targetRows[0]
    if (!target) {
      set.status = 404
      return { error: 'Target user not found.' }
    }

    const targetIsBootstrapAdmin = normalizeEmail(target.email) === BOOTSTRAP_ADMIN_EMAIL
    if (targetIsBootstrapAdmin && !nextIsAdmin) {
      set.status = 400
      return { error: 'Bootstrap admin access cannot be removed.' }
    }

    const actorIsBootstrapAdmin = normalizeEmail(authUser.email) === BOOTSTRAP_ADMIN_EMAIL
    if (!nextIsAdmin && targetUserId === authUser.id && !actorIsBootstrapAdmin) {
      set.status = 400
      return { error: 'You cannot remove your own admin access.' }
    }

    try {
      if (nextIsAdmin) {
        await db
          .insert(adminUser)
          .values({
            userId: targetUserId,
            grantedByUserId: authUser.id,
            createdAt: new Date(),
          })
          .onConflictDoNothing()
      } else {
        await db.delete(adminUser).where(eq(adminUser.userId, targetUserId))
      }
    } catch (error) {
      if (isMissingAdminTableError(error)) {
        set.status = 503
        return { error: 'Admin table migration is missing. Run database migrations and retry.' }
      }
      throw error
    }

    const [profileRow] = await db
      .select({ username: userProfile.username })
      .from(userProfile)
      .where(eq(userProfile.userId, targetUserId))
      .limit(1)

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        userId: target.id,
        name: target.name,
        email: target.email,
        username: profileRow?.username ?? null,
        image: target.image ?? null,
        createdAt: target.createdAt.getTime(),
        isAdmin: nextIsAdmin || targetIsBootstrapAdmin,
        isBootstrapAdmin: targetIsBootstrapAdmin,
      },
    }
  })
  .get('/overview', async ({ request, set }) => {
    const authUser = await ensureAdmin(request, set)
    if (!authUser) return { error: 'Forbidden.' }

    const now = Date.now()
    const dayMs = 1000 * 60 * 60 * 24
    const sevenDaysAgo = new Date(now - dayMs * 7)

    try {
      const [
        totalUsersRows,
        newUsersRows,
        totalRatingsRows,
        weeklyRatingsRows,
        totalReviewsRows,
        weeklyReviewsRows,
        activeListRows,
        weeklySearchRows,
        averageRatingRows,
        adminRows,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(user),
        db.select({ count: sql<number>`count(*)` }).from(user).where(sql`${user.createdAt} >= ${sevenDaysAgo}`),
        db.select({ count: sql<number>`count(*)` }).from(userRating),
        db.select({ count: sql<number>`count(*)` }).from(userRating).where(sql`${userRating.updatedAt} >= ${sevenDaysAgo}`),
        db.select({ count: sql<number>`count(*)` }).from(userReview),
        db.select({ count: sql<number>`count(*)` }).from(userReview).where(sql`${userReview.updatedAt} >= ${sevenDaysAgo}`),
        db.select({ count: sql<number>`count(*)` }).from(userList),
        db
          .select({ count: sql<number>`coalesce(sum(${userSearchTrend.searchCount}), 0)` })
          .from(userSearchTrend)
          .where(sql`${userSearchTrend.updatedAt} >= ${sevenDaysAgo}`),
        db.select({ average: sql<number>`coalesce(avg(${userRating.rating}), 0)` }).from(userRating),
        db.select({ count: sql<number>`count(*)` }).from(adminUser),
      ])

      const [recentReviewsRows, topQueriesRows, recentActivitiesRows] = await Promise.all([
        db
          .select({
            id: userReview.id,
            userId: userReview.userId,
            albumId: userReview.albumId,
            albumName: userReview.albumName,
            content: userReview.content,
            updatedAt: userReview.updatedAt,
            userName: user.name,
            userImage: user.image,
          })
          .from(userReview)
          .innerJoin(user, eq(user.id, userReview.userId))
          .orderBy(desc(userReview.updatedAt))
          .limit(8),
        db
          .select({
            query: userSearchTrend.displayQuery,
            normalizedQuery: userSearchTrend.normalizedQuery,
            searchCount: userSearchTrend.searchCount,
            lastSearchedAt: userSearchTrend.lastSearchedAt,
          })
          .from(userSearchTrend)
          .orderBy(desc(userSearchTrend.searchCount), desc(userSearchTrend.lastSearchedAt))
          .limit(10),
        db
          .select({
            id: activity.id,
            userId: activity.userId,
            type: activity.type,
            albumName: activity.albumName,
            createdAt: activity.createdAt,
            userName: user.name,
          })
          .from(activity)
          .innerJoin(user, eq(user.id, activity.userId))
          .orderBy(desc(activity.createdAt))
          .limit(8),
      ])

      const data = {
        metrics: {
          totalUsers: Number(totalUsersRows[0]?.count ?? 0),
          newUsers7d: Number(newUsersRows[0]?.count ?? 0),
          totalRatings: Number(totalRatingsRows[0]?.count ?? 0),
          ratings7d: Number(weeklyRatingsRows[0]?.count ?? 0),
          totalReviews: Number(totalReviewsRows[0]?.count ?? 0),
          reviews7d: Number(weeklyReviewsRows[0]?.count ?? 0),
          totalLists: Number(activeListRows[0]?.count ?? 0),
          searches7d: Number(weeklySearchRows[0]?.count ?? 0),
          averageRating: Math.round(Number(averageRatingRows[0]?.average ?? 0) * 10) / 10,
          adminCount: Number(adminRows[0]?.count ?? 0) + 1,
        },
        recentReviews: recentReviewsRows.map((entry) => ({
          id: entry.id,
          userId: entry.userId,
          userName: entry.userName,
          userImage: entry.userImage ?? null,
          albumId: entry.albumId,
          albumName: entry.albumName,
          content: entry.content,
          updatedAt: entry.updatedAt.getTime(),
        })),
        topQueries: topQueriesRows.map((entry) => ({
          query: entry.query,
          normalizedQuery: entry.normalizedQuery,
          searchCount: Number(entry.searchCount ?? 0),
          lastSearchedAt: entry.lastSearchedAt.getTime(),
        })),
        recentActivity: recentActivitiesRows.map((entry) => ({
          id: entry.id,
          userId: entry.userId,
          userName: entry.userName,
          type: entry.type,
          albumName: entry.albumName ?? null,
          createdAt: entry.createdAt.getTime(),
        })),
      }

      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return { data }
    } catch (error) {
      if (isMissingAdminTableError(error)) {
        set.status = 503
        return { error: 'Admin migration is pending. Run database migrations first.' }
      }
      throw error
    }
  })
  .get('/reviews', async ({ request, query, set }) => {
    const authUser = await ensureAdmin(request, set)
    if (!authUser) return { error: 'Forbidden.' }

    const status = String(query?.status ?? 'all').trim().toLowerCase()
    const limitParam = Number(query?.limit)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20

    const reviews = await db
      .select({
        id: userReview.id,
        userId: userReview.userId,
        albumId: userReview.albumId,
        albumName: userReview.albumName,
        content: userReview.content,
        createdAt: userReview.createdAt,
        updatedAt: userReview.updatedAt,
        userName: user.name,
        userImage: user.image,
      })
      .from(userReview)
      .innerJoin(user, eq(user.id, userReview.userId))
      .orderBy(desc(userReview.updatedAt))
      .limit(limit)

    const mapped = reviews.map((entry) => {
      const lowerContent = String(entry.content ?? '').toLowerCase()
      const isFlagged = /spam|hate|abuse|scam|fake/.test(lowerContent)

      return {
        id: entry.id,
        userId: entry.userId,
        userName: entry.userName,
        userImage: entry.userImage ?? null,
        albumId: entry.albumId,
        albumName: entry.albumName,
        content: entry.content,
        createdAt: entry.createdAt.getTime(),
        updatedAt: entry.updatedAt.getTime(),
        isFlagged,
      }
    })

    const filtered =
      status === 'flagged'
        ? mapped.filter((entry) => entry.isFlagged)
        : status === 'clean'
          ? mapped.filter((entry) => !entry.isFlagged)
          : mapped

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data: filtered }
  })
  .delete('/reviews/:reviewId', async ({ request, params, set }) => {
    const authUser = await ensureAdmin(request, set)
    if (!authUser) return { error: 'Forbidden.' }

    const reviewId = String(params?.reviewId ?? '').trim()
    if (!reviewId) {
      set.status = 400
      return { error: 'Missing review id.' }
    }

    const [existing] = await db
      .select({
        id: userReview.id,
        userId: userReview.userId,
        albumId: userReview.albumId,
        albumName: userReview.albumName,
      })
      .from(userReview)
      .where(eq(userReview.id, reviewId))
      .limit(1)

    if (!existing) {
      set.status = 404
      return { error: 'Review not found.' }
    }

    await db.delete(userReview).where(eq(userReview.id, reviewId))

    recordActivity({
      userId: authUser.id,
      type: 'reviewed',
      albumId: existing.albumId,
      albumName: existing.albumName,
      metadata: {
        action: 'admin_review_delete',
        removedReviewId: reviewId,
        removedUserId: existing.userId,
      },
    })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data: { deleted: true, reviewId } }
  })
