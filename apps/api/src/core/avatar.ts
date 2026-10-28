import { sql } from 'drizzle-orm'

import { env } from './env'
import { user } from './schema'

// Uploaded avatars are stored inline as data URLs (up to ~2.8MB); lists link to /api/avatars instead of repeating the bytes per row.
const INLINE_AVATAR = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,/
export const avatarUrl = () => sql<string | null>`case when ${user.image} ~ ${INLINE_AVATAR.source}
  then ${`${env.BETTER_AUTH_URL}/api/avatars/`} || ${user.id} || '?v=' || floor(extract(epoch from ${user.updatedAt}))::bigint
  else ${user.image} end`
export const toAvatarUrl = ({ id, image, updatedAt }: { id: string; image?: string | null; updatedAt: Date }) =>
  image && INLINE_AVATAR.test(image) ? `${env.BETTER_AUTH_URL}/api/avatars/${id}?v=${Math.floor(updatedAt.getTime() / 1000)}` : image ?? null
export const decodeInlineAvatar = (image: string | null | undefined) => {
  const match = INLINE_AVATAR.exec(image ?? '')
  return match ? { type: match[1]!, bytes: Buffer.from(image!.slice(match[0].length), 'base64') } : null
}
export const isOwnAvatarUrl = (value: string, userId: string) =>
  value.trim().startsWith(`${env.BETTER_AUTH_URL}/api/avatars/${userId}?`)
