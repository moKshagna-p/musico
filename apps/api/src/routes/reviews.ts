import { Elysia } from 'elysia'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../core/db'
import { user, userReview } from '../core/schema'
import {
  ensureAuthenticated,
  getCanonicalAlbumMetadata,
  recordActivity,
} from '../core/utils'
import { MAX_REVIEW_LENGTH } from '../core/constants'
import { isRecord, readBoundedText, readIdentifier } from './validation'

export const reviewRoutes = new Elysia()
  .put('/api/me/reviews/:albumId', async ({ request, params, body, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const albumId = readIdentifier(params?.albumId)
    if (!albumId) {
      set.status = 400
      return { error: 'Missing album id.' }
    }

    const typedBody = isRecord(body) ? body : null
    const rawContent = readBoundedText(typedBody?.content, MAX_REVIEW_LENGTH)
    const content = rawContent?.slice(0, MAX_REVIEW_LENGTH) ?? ''

    if (!content) {
      set.status = 400
      return { error: 'Review content cannot be empty.' }
    }

    // Ensure we have canonical metadata for the activity feed
    const meta = await getCanonicalAlbumMetadata(albumId, {
      name: typedBody?.albumName,
      cover: typedBody?.albumCover,
      artists: typedBody?.artists,
      releaseYear: typedBody?.releaseYear,
    })

    const now = new Date()
    const result = await db
      .insert(userReview)
      .values({
        id: crypto.randomUUID(),
        userId: authUser.id,
        albumId,
        albumName: meta.name,
        content,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userReview.userId, userReview.albumId],
        set: {
          content,
          albumName: meta.name,
          updatedAt: now,
        },
      })
      .returning()

    recordActivity({
      userId: authUser.id,
      type: 'reviewed',
      albumId,
      albumName: meta.name,
      albumCover: meta.cover,
      metadata: { reviewId: result[0]?.id },
    })

    return {
      data: {
        ...result[0],
        createdAt: result[0]?.createdAt.getTime(),
        updatedAt: result[0]?.updatedAt.getTime(),
      },
    }
  })
  .delete('/api/me/reviews/:albumId', async ({ request, params, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const albumId = readIdentifier(params?.albumId)
    if (!albumId) {
      set.status = 400
      return { error: 'Missing album id.' }
    }

    await db.delete(userReview).where(sql`${userReview.userId} = ${authUser.id} and ${userReview.albumId} = ${albumId}`)

    return { data: { deleted: true, albumId } }
  })
  .get('/api/me/reviews', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const reviews = await db
      .select()
      .from(userReview)
      .where(eq(userReview.userId, authUser.id))
      .orderBy(desc(userReview.updatedAt))

    return {
      data: reviews.map((r) => ({
        ...r,
        createdAt: r.createdAt.getTime(),
        updatedAt: r.updatedAt.getTime(),
      })),
    }
  })
  .get('/api/albums/:albumId/reviews', async ({ params, query, set }) => {
    const albumId = readIdentifier(params?.albumId)
    if (!albumId) {
      set.status = 400
      return { error: 'Missing album id.' }
    }

    const limitParam = Number(query?.limit)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10

    const reviews = await db
      .select({
        id: userReview.id,
        userId: userReview.userId,
        content: userReview.content,
        updatedAt: userReview.updatedAt,
        userName: user.name,
        userImage: user.image,
      })
      .from(userReview)
      .innerJoin(user, eq(user.id, userReview.userId))
      .where(eq(userReview.albumId, albumId))
      .orderBy(desc(userReview.updatedAt))
      .limit(limit)

    return {
      data: reviews.map((r) => ({
        ...r,
        updatedAt: r.updatedAt.getTime(),
      })),
    }
  })
