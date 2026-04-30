import { Elysia } from 'elysia'
import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '../core/db'
import { activity, user, userFollow } from '../core/schema'
import { ensureAuthenticated } from '../core/utils'

export const activityRoutes = new Elysia()
  .get('/api/me/feed', async ({ request, query, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const limitParam = Number(query?.limit)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20

    // Get users that authUser follows
    const following = await db
      .select({ followingId: userFollow.followingId })
      .from(userFollow)
      .where(eq(userFollow.followerId, authUser.id))

    const followingIds = following.map((f) => f.followingId)
    followingIds.push(authUser.id) // Include own activity

    if (followingIds.length === 0) {
      return { data: [] }
    }

    const feed = await db
      .select({
        id: activity.id,
        userId: activity.userId,
        type: activity.type,
        albumId: activity.albumId,
        albumName: activity.albumName,
        albumCover: activity.albumCover,
        targetUserId: activity.targetUserId,
        metadata: activity.metadata,
        createdAt: activity.createdAt,
        userName: user.name,
        userImage: user.image,
      })
      .from(activity)
      .innerJoin(user, eq(user.id, activity.userId))
      .where(inArray(activity.userId, followingIds))
      .orderBy(desc(activity.createdAt))
      .limit(limit)

    return {
      data: feed.map((item) => ({
        ...item,
        createdAt: item.createdAt.getTime(),
      })),
    }
  })
