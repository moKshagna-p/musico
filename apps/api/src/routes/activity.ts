import { Elysia } from 'elysia'
import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '../core/db'
import { activity, user, userFollow } from '../core/schema'
import { ensureAuthenticated } from '../core/utils'

type FeedRow = {
  id: string
  userId: string
  type: string
  albumId: string | null
  albumName: string | null
  albumCover: string | null
  targetUserId: string | null
  metadata: unknown
  createdAt: Date
  userName: string
  userImage: string | null
}

type FeedUser = Pick<typeof user.$inferSelect, 'name' | 'image'>

export const toFeedItem = ({ userName, userImage, createdAt, ...item }: FeedRow, targetUser?: FeedUser) => ({
  ...item,
  createdAt: createdAt.getTime(),
  user: {
    name: userName,
    image: userImage,
  },
  ...(targetUser ? { targetUser } : {}),
})

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

    const targetUserIds = [...new Set(feed
      .map((item) => item.targetUserId)
      .filter((id): id is string => Boolean(id)))]
    const targetUsers = targetUserIds.length
      ? await db.select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(inArray(user.id, targetUserIds))
      : []
    const targetUsersById = new Map(targetUsers.map(({ id, ...targetUser }) => [id, targetUser]))

    return {
      data: feed.map((item) => toFeedItem(
        item,
        item.targetUserId ? targetUsersById.get(item.targetUserId) : undefined,
      )),
    }
  })
