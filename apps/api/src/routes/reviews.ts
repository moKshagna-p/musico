import { Elysia } from 'elysia'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../core/db'
import { avatarUrl } from '../core/avatar'
import { MEDIA_WRITE_LOCK, isKlipyUrl, mediaUrl } from '../core/media'
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

    const now = new Date()
    const reviewId = crypto.randomUUID()
    const gifId = crypto.randomUUID()
    let saved: typeof userReview.$inferSelect
    let savedMedia: ReturnType<typeof toMedia>[]
    try {
      const [, result] = await db.batch([
        db.execute(MEDIA_WRITE_LOCK),
        db.execute(sql`
          with requested as (
            select item->>'id' as id, item->>'alt' as alt, (ordinality - 1)::int as position
            from jsonb_array_elements(${JSON.stringify(media.images)}::text::jsonb) with ordinality as input(item, ordinality)
          ), uploads as (
            select m.* from review_media m join requested r on r.id = m.id
            where m."userId" = ${authUser.id} and m.kind = 'image' and m.state = 'ready'
              and (m."reviewId" is null or m."reviewId" = (
                select id from user_review where "userId" = ${authUser.id} and "albumId" = ${albumId}
              ))
          ), saved as (
            insert into user_review (id, "userId", "albumId", "albumName", content, "createdAt", "updatedAt")
            select ${reviewId}, ${authUser.id}, ${albumId}, ${meta.name}, ${content}, ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz
            where (select count(*) from uploads) = ${media.images.length}
            on conflict ("userId", "albumId") do update
              set content = excluded.content, "albumName" = excluded."albumName", "updatedAt" = excluded."updatedAt"
            returning *
          ), dropped as (
            update review_media set "reviewId" = null
            where "reviewId" = (select id from saved) and id not in (select id from requested)
          ), attached as (
            update review_media m set "reviewId" = saved.id, position = r.position, alt = r.alt
            from saved, requested r where m.id = r.id and m."userId" = ${authUser.id}
              and m.state = 'ready' and (m."reviewId" is null or m."reviewId" = saved.id)
            returning m.*
          ), gif as (
            insert into review_media (id, "userId", "reviewId", kind, url, width, height, alt, "createdAt")
            select ${gifId}, ${authUser.id}, id, 'gif', ${media.gif?.url ?? null},
              ${media.gif?.width ?? 1}, ${media.gif?.height ?? 1}, ${media.gif?.alt ?? ''}, ${now.toISOString()}::timestamptz
            from saved where ${Boolean(media.gif)}
            returning *
          )
          select saved.*, (extract(epoch from saved."createdAt") * 1000)::float8 as "createdAtMs",
            (extract(epoch from saved."updatedAt") * 1000)::float8 as "updatedAtMs",
            coalesce((select json_agg(m order by m.position) from (
              select * from attached union all select * from gif
            ) m), '[]') as media
          from saved
        `),
      ])
      const row = result.rows[0] as (typeof userReview.$inferSelect & { createdAtMs: number; updatedAtMs: number; media: MediaRow[] }) | undefined
      if (!row) {
        set.status = 400
        return { error: 'An image is no longer available. Remove it and try again.' }
      }
      const { createdAtMs, updatedAtMs, media: rows, ...review } = row
      saved = { ...review, createdAt: new Date(createdAtMs), updatedAt: new Date(updatedAtMs) }
      savedMedia = rows.map(toMedia)
    } catch (error) {
      // Text-only reviews keep working until the review_media migration is applied.
      if (!isMissingTableError(error, 'review_media') || media.images.length || media.gif) throw error
      ;[saved] = await db.insert(userReview).values({
        id: reviewId, userId: authUser.id, albumId, albumName: meta.name, content, createdAt: now, updatedAt: now,
      }).onConflictDoUpdate({
        target: [userReview.userId, userReview.albumId],
        set: { content, albumName: meta.name, updatedAt: now },
      }).returning()
      savedMedia = []
    }

    await recordActivity({
      userId: authUser.id,
      type: 'reviewed',
      albumId,
      albumName: meta.name,
      albumCover: meta.cover,
      metadata: { reviewId: saved.id },
    })

    return {
      data: {
        ...saved,
        createdAt: saved.createdAt.getTime(),
        updatedAt: saved.updatedAt.getTime(),
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
