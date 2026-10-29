import { Elysia } from 'elysia'
import { and, eq, sql } from 'drizzle-orm'

import { db } from '../core/db'
import { MEDIA_WRITE_LOCK, mediaKey, mediaStore, mediaUrl, parseMediaKey, sniffImage } from '../core/media'
import { reviewMedia } from '../core/schema'
import { ensureAuthenticated, isMissingTableError } from '../core/utils'
import { MAX_MEDIA_BYTES, MAX_MEDIA_UPLOADS_PER_DAY, MEDIA_STORAGE_BUDGET_BYTES } from '../core/constants'
import { searchGifs } from '../services/klipy'
import { MAX_SEARCH_QUERY_LENGTH, isRecord, readBoundedInteger, readBoundedText } from './validation'

const DAY_MS = 1000 * 60 * 60 * 24
const MAX_DIMENSION = 10000

export const mediaRoutes = new Elysia({ prefix: '/api' })
  // Images are uploaded as soon as they are picked, then attached when the review is posted.
  .post('/me/media', async ({ request, body, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const form = isRecord(body) ? body : null
    const file = form?.file
    // Dimensions only size the placeholder before the image loads, so the client's word is good enough.
    const width = readBoundedInteger(form?.width, { defaultValue: 0, min: 1, max: MAX_DIMENSION })
    const height = readBoundedInteger(form?.height, { defaultValue: 0, min: 1, max: MAX_DIMENSION })
    if (!(file instanceof Blob) || !width || !height) {
      set.status = 400
      return { error: 'Send an image file with its width and height.' }
    }
    if (file.size > MAX_MEDIA_BYTES) {
      set.status = 413
      return { error: 'Images can be up to 5MB.' }
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const extension = sniffImage(bytes)
    if (!extension) {
      set.status = 415
      return { error: 'Only JPEG, PNG, WebP, and GIF images are supported.' }
    }

    try {
      const id = crypto.randomUUID()
      const key = mediaKey(authUser.id, id, extension)
      const store = mediaStore()
      // The row reserves both quotas before R2 is touched, including uploads still in flight.
      const [, reservation] = await db.batch([
        db.execute(MEDIA_WRITE_LOCK),
        db.execute(sql`
          with totals as (
            select coalesce(sum(size), 0) as bytes,
              count(*) filter (where "userId" = ${authUser.id}
                and "createdAt" > ${new Date(Date.now() - DAY_MS).toISOString()}::timestamptz) as recent
            from review_media
          ), reserved as (
            insert into review_media (id, "userId", kind, state, key, size, width, height, "createdAt")
            select ${id}, ${authUser.id}, 'image', 'uploading', ${key}, ${bytes.byteLength}, ${width}, ${height}, now()
            from totals where recent < ${MAX_MEDIA_UPLOADS_PER_DAY}
              and bytes + ${bytes.byteLength} <= ${MEDIA_STORAGE_BUDGET_BYTES}
            returning id
          )
          select recent, bytes, exists(select 1 from reserved) as reserved from totals
        `),
      ])
      const quota = reservation.rows[0] as { recent: number; bytes: number; reserved: boolean }
      if (!quota.reserved) {
        if (Number(quota.recent) >= MAX_MEDIA_UPLOADS_PER_DAY) {
          set.status = 429
          return { error: 'Daily image limit reached. Try again tomorrow.' }
        }
        console.error('[media.upload] storage budget reached', { bytes: quota.bytes })
        set.status = 507
        return { error: 'Image uploads are paused right now.' }
      }

      try {
        await store.put(key, bytes, parseMediaKey(key)!.contentType)
        const ready = await db.update(reviewMedia).set({ state: 'ready' })
          .where(and(eq(reviewMedia.id, id), eq(reviewMedia.state, 'uploading'))).returning({ id: reviewMedia.id })
        if (!ready.length) throw new Error('Upload expired before it finished.')
      } catch (error) {
        // A failed delete retains its reservation and is retried by the sweep.
        await db.update(reviewMedia).set({ state: 'deleting' }).where(eq(reviewMedia.id, id))
        try {
          await store.delete([key])
          await db.delete(reviewMedia).where(eq(reviewMedia.id, id))
        } catch (cleanupError) {
          console.error('[media.upload] cleanup failed', cleanupError)
        }
        throw error
      }

      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return { data: { id, kind: 'image', url: mediaUrl(key), width, height } }
    } catch (error) {
      if (isMissingTableError(error, 'review_media')) {
        set.status = 503
        return { error: 'Image uploads need the latest database migration.' }
      }
      console.error('[media.upload] error', error)
      set.status = 502
      return { error: 'Unable to upload that image right now.' }
    }
  })
  // Keys are random and never reused, so the bytes behind a URL never change.
  .get('/media/*', async ({ params, set }) => {
    const key = String(params['*'] ?? '')
    const parsed = parseMediaKey(key)
    const body = parsed ? await mediaStore().get(key) : null
    if (!parsed || !body) {
      set.status = 404
      return { error: 'Image not found.' }
    }
    return new Response(body, {
      headers: {
        'Content-Type': parsed.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })
  .get('/gifs', async ({ request, query, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const q = readBoundedText(query?.q ?? '', MAX_SEARCH_QUERY_LENGTH)
    const page = readBoundedInteger(query?.page, { defaultValue: 1, min: 1, max: 20 })
    if (q === null || page === null) {
      set.status = 400
      return { error: 'Invalid GIF search.' }
    }

    try {
      const gifs = await searchGifs(q, page)
      if (!gifs) {
        set.status = 503
        return { error: 'GIF search is not configured.' }
      }
      set.headers ??= {}
      set.headers['Cache-Control'] = 'private, max-age=300'
      return { data: gifs }
    } catch (error) {
      console.error('[media.gifs] error', error instanceof Error ? error.message : String(error))
      set.status = 502
      return { error: 'GIF search is unavailable right now.' }
    }
  })
