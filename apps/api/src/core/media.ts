import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm'

import { db } from './db'
import { env } from './env'
import { reviewMedia } from './schema'

// Review images live in the MEDIA R2 bucket (wrangler.toml) and are served back through /api/media/<key>.
// The Bun dev server has no bindings, so it keeps them under apps/api/.media instead.

type R2Binding = {
  put: (key: string, value: Uint8Array, options: { httpMetadata: { contentType: string } }) => Promise<unknown>
  get: (key: string) => Promise<{ body: ReadableStream } | null>
  delete: (keys: string[]) => Promise<void>
}

type MediaStore = {
  put: (key: string, bytes: Uint8Array, contentType: string) => Promise<void>
  get: (key: string) => Promise<BodyInit | null>
  delete: (keys: string[]) => Promise<void>
}

const fromR2 = (bucket: R2Binding): MediaStore => ({
  put: async (key, bytes, contentType) => {
    await bucket.put(key, bytes, { httpMetadata: { contentType } })
  },
  get: async (key) => (await bucket.get(key))?.body ?? null,
  delete: (keys) => bucket.delete(keys),
})

// Resolved on first use: import.meta.url isn't a file path inside the Worker bundle.
const fromDisk = (): MediaStore => {
  const path = (key: string) => new URL(`../../.media/${key}`, import.meta.url)
  return {
    put: async (key, bytes) => {
      await Bun.write(path(key), bytes)
    },
    get: async (key) => {
      const file = Bun.file(path(key))
      return (await file.exists()) ? file.stream() : null
    },
    delete: async (keys) => {
      const { rm } = await import('node:fs/promises')
      await Promise.all(keys.map((key) => rm(path(key), { force: true })))
    },
  }
}

export const mediaStore = (): MediaStore => {
  const bucket = (globalThis as { __MUSICO_WORKER_ENV__?: { MEDIA?: R2Binding } }).__MUSICO_WORKER_ENV__?.MEDIA
  if (bucket) return fromR2(bucket)
  if (typeof Bun !== 'undefined') return fromDisk()
  throw new Error('Media storage is not configured: bind the MEDIA R2 bucket in wrangler.toml.')
}

// Trust the bytes, not the client's Content-Type.
const IMAGE_TYPES = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
} as const
export type ImageExtension = keyof typeof IMAGE_TYPES

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte)

export const sniffImage = (bytes: Uint8Array): ImageExtension | null => {
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif'
  return null
}

const MEDIA_KEY = /^reviews\/[A-Za-z0-9_-]{1,128}\/[0-9a-f-]{36}\.(webp|jpg|png|gif)$/
export const mediaKey = (userId: string, id: string, extension: ImageExtension) => `reviews/${userId}/${id}.${extension}`
export const parseMediaKey = (key: string) => {
  const match = MEDIA_KEY.exec(key)
  return match ? { contentType: IMAGE_TYPES[match[1] as ImageExtension] } : null
}
export const mediaUrl = (key: string) => `${env.BETTER_AUTH_URL}/api/media/${key}`

// GIFs are hotlinked from KLIPY's CDN, so only accept https URLs on klipy.com hosts.
export const isKlipyUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'klipy.com' || url.hostname.endsWith('.klipy.com'))
  } catch {
    return false
  }
}

const SWEEP_AFTER_MS = 1000 * 60 * 60 * 24
const SWEEP_BATCH = 500

// Take this in a separate statement of a READ COMMITTED batch so subsequent reads see the previous writer's commit.
export const MEDIA_WRITE_LOCK = sql`select pg_advisory_xact_lock(750013)`

// Uploads never posted, media dropped from an edited review, and media of deleted reviews.
export const sweepDetachedMedia = async (now = new Date()) => {
  const detached = and(isNull(reviewMedia.reviewId), lt(reviewMedia.createdAt, new Date(now.getTime() - SWEEP_AFTER_MS)))
  const candidates = db.select({ id: reviewMedia.id })
    .from(reviewMedia)
    .where(detached)
    .limit(SWEEP_BATCH)
  const [, rows] = await db.batch([
    db.execute(MEDIA_WRITE_LOCK),
    db.update(reviewMedia).set({ state: 'deleting' })
      .where(and(detached, inArray(reviewMedia.id, candidates)))
      .returning({ id: reviewMedia.id, key: reviewMedia.key }),
  ])
  if (!rows.length) return 0
  const keys = rows.flatMap((row) => (row.key ? [row.key] : []))
  // Claimed rows cannot be attached; keep them for retry if object deletion fails.
  if (keys.length) await mediaStore().delete(keys)
  await db.delete(reviewMedia).where(and(eq(reviewMedia.state, 'deleting'), inArray(reviewMedia.id, rows.map((row) => row.id))))
  return rows.length
}
