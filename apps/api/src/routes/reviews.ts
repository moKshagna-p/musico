import { Elysia } from 'elysia'
import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db } from '../core/db'
import { avatarUrl } from '../core/avatar'
import { isKlipyUrl, mediaUrl } from '../core/media'
import { reviewMedia, user, userProfile, userReview } from '../core/schema'
import {
  ensureAuthenticated,
  getCanonicalAlbumMetadata,
  isMissingTableError,
  recordActivity,
} from '../core/utils'
import { MAX_ALT_TEXT_LENGTH, MAX_MEDIA_PER_REVIEW, MAX_REVIEW_LENGTH } from '../core/constants'
import { isRecord, readBoundedInteger, readBoundedText, readIdentifier } from './validation'

type MediaRow = { id: string; kind: 'image' | 'gif'; key: string | null; url: string | null; width: number; height: number; alt: string }
const toMedia = (row: MediaRow) => ({
  id: row.id,
  kind: row.kind,
  url: row.kind === 'image' ? mediaUrl(row.key ?? '') : row.url ?? '',
  width: row.width,
  height: row.height,
  alt: row.alt,
})

// Up to four uploaded images or one KLIPY GIF, like a tweet. Returns null when the shape is wrong.
export const readReviewMedia = (body: Record<string, unknown> | null) => {
  const rawImages = body?.media ?? []
  if (!Array.isArray(rawImages) || rawImages.length > MAX_MEDIA_PER_REVIEW) return null
  const images: { id: string; alt: string }[] = []
  for (const item of rawImages) {
    const id = isRecord(item) ? readIdentifier(item.id) : null
    const alt = isRecord(item) ? readBoundedText(item.alt ?? '', MAX_ALT_TEXT_LENGTH) : null
    if (!id || alt === null || images.some((image) => image.id === id)) return null
    images.push({ id, alt })
  }

  if (body?.gif === undefined || body.gif === null) return { images, gif: null }
  const raw = isRecord(body.gif) ? body.gif : null
  const size = { defaultValue: 0, min: 1, max: 10000 }
  const gif = raw && {
    url: isKlipyUrl(raw.url) ? String(raw.url) : '',
    width: readBoundedInteger(raw.width, size) ?? 0,
    height: readBoundedInteger(raw.height, size) ?? 0,
    alt: readBoundedText(raw.alt ?? '', MAX_ALT_TEXT_LENGTH),
  }
  if (!gif?.url || !gif.width || !gif.height || gif.alt === null || images.length) return null
  return { images, gif: { ...gif, alt: gif.alt } }
}

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
    const content = readBoundedText(typedBody?.content ?? '', MAX_REVIEW_LENGTH)
    const media = readReviewMedia(typedBody)

    if (content === null) {
      set.status = 400
      return { error: `Reviews can be up to ${MAX_REVIEW_LENGTH} characters.` }
    }
    if (!media) {
      set.status = 400
      return { error: 'Attach up to 4 images or 1 GIF.' }
    }
    if (!content && !media.images.length && !media.gif) {
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

    const [existing] = await db
      .select({ id: userReview.id })
      .from(userReview)
      .where(and(eq(userReview.userId, authUser.id), eq(userReview.albumId, albumId)))
      .limit(1)
    const reviewId = existing?.id ?? crypto.randomUUID()
    const imageIds = media.images.map((image) => image.id)

    // Only the author's own uploads, not yet on another review.
    const uploads = imageIds.length
      ? await db
          .select({ id: reviewMedia.id, reviewId: reviewMedia.reviewId, key: reviewMedia.key, width: reviewMedia.width, height: reviewMedia.height })
          .from(reviewMedia)
          .where(and(inArray(reviewMedia.id, imageIds), eq(reviewMedia.userId, authUser.id), eq(reviewMedia.kind, 'image')))
      : []
    if (uploads.length !== imageIds.length || uploads.some((upload) => upload.reviewId && upload.reviewId !== reviewId)) {
      set.status = 400
      return { error: 'An image is no longer available. Remove it and try again.' }
    }

    const now = new Date()
    const saveReview = db
      .insert(userReview)
      .values({
        id: reviewId,
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
    const gifId = crypto.randomUUID()
    // Dropped media is detached, not deleted: the cron removes it (and its R2 object) a day later.
    const saveMedia = [
      db
        .update(reviewMedia)
        .set({ reviewId: null })
        .where(and(eq(reviewMedia.reviewId, reviewId), imageIds.length ? notInArray(reviewMedia.id, imageIds) : undefined)),
      ...media.images.map((image, position) =>
        db
          .update(reviewMedia)
          .set({ reviewId, position, alt: image.alt })
          .where(and(eq(reviewMedia.id, image.id), eq(reviewMedia.userId, authUser.id))),
      ),
      ...(media.gif
        ? [db.insert(reviewMedia).values({ id: gifId, userId: authUser.id, reviewId, kind: 'gif', ...media.gif, createdAt: now })]
        : []),
    ]

    let result: (typeof userReview.$inferSelect)[]
    try {
      ;[result] = await db.batch([saveReview, ...saveMedia])
    } catch (error) {
      // Text-only reviews keep working until the review_media migration is applied.
      if (!isMissingTableError(error, 'review_media') || imageIds.length || media.gif) throw error
      result = await saveReview
    }

    const savedMedia = [
      ...media.images.map((image) => {
        const upload = uploads.find((row) => row.id === image.id)!
        return toMedia({ ...upload, kind: 'image', url: null, alt: image.alt })
      }),
      ...(media.gif ? [toMedia({ id: gifId, kind: 'gif', key: null, ...media.gif })] : []),
    ]

    await recordActivity({
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
        media: savedMedia,
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
  .get('/api/albums/:albumId/reviews', async ({ request, params, query, set }) => {
    set.headers ??= {}
    set.headers['Cache-Control'] = 'private, no-store'
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

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
        content: userReview.content,
        updatedAt: userReview.updatedAt,
        userName: user.name,
        userUsername: userProfile.username,
        userImage: avatarUrl(),
      })
      .from(userReview)
      .innerJoin(user, eq(user.id, userReview.userId))
      .leftJoin(userProfile, eq(userProfile.userId, userReview.userId))
      .where(eq(userReview.albumId, albumId))
      .orderBy(desc(userReview.updatedAt))
      .limit(limit)

    const mediaRows = reviews.length
      ? await db
          .select({
            id: reviewMedia.id,
            reviewId: reviewMedia.reviewId,
            kind: reviewMedia.kind,
            key: reviewMedia.key,
            url: reviewMedia.url,
            width: reviewMedia.width,
            height: reviewMedia.height,
            alt: reviewMedia.alt,
          })
          .from(reviewMedia)
          .where(inArray(reviewMedia.reviewId, reviews.map((r) => r.id)))
          .orderBy(asc(reviewMedia.position))
          .catch((error) => {
            if (isMissingTableError(error, 'review_media')) return []
            throw error
          })
      : []

    return {
      data: reviews.map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.updatedAt.getTime(),
        user: { name: r.userName, username: r.userUsername, image: r.userImage },
        media: mediaRows.filter((row) => row.reviewId === r.id).map(toMedia),
      })),
    }
  })
