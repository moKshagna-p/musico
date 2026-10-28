import { sql } from 'drizzle-orm'

import { env } from './env'
import { user } from './schema'

// Uploaded avatars live in user_avatar and user.image holds the relative AVATAR_PATH link (relative because local dev
// and production share one database). Rows not yet moved still hold an inline data URL (up to ~2.8MB).
const INLINE_AVATAR = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,/
const AVATAR_PATH = '/api/avatars/'
export const avatarPath = (userId: string, at: Date) => `${AVATAR_PATH}${userId}?v=${Math.floor(at.getTime() / 1000)}`
export const avatarUrl = () => sql<string | null>`case when ${user.image} ~ ${INLINE_AVATAR.source}
  then ${`${env.BETTER_AUTH_URL}${AVATAR_PATH}`} || ${user.id} || '?v=' || floor(extract(epoch from ${user.updatedAt}))::bigint
  when starts_with(${user.image}, ${AVATAR_PATH}) then ${env.BETTER_AUTH_URL} || ${user.image}
  else ${user.image} end`
export const toAvatarUrl = ({ id, image, updatedAt }: { id: string; image?: string | null; updatedAt: Date }) => {
  if (image && INLINE_AVATAR.test(image)) return `${env.BETTER_AUTH_URL}${avatarPath(id, updatedAt)}`
  return image?.startsWith(AVATAR_PATH) ? `${env.BETTER_AUTH_URL}${image}` : image ?? null
}
export const parseInlineAvatar = (image: string | null | undefined) => {
  const match = INLINE_AVATAR.exec(image ?? '')
  return match ? { contentType: match[1]!, data: image!.slice(match[0].length) } : null
}
export const isOwnAvatarUrl = (value: string, userId: string) =>
  value.trim().startsWith(`${env.BETTER_AUTH_URL}${AVATAR_PATH}${userId}?`)

const COVER_PATH = '/api/covers/'
export const coverUrl = (userId: string, at: Date) => `${env.BETTER_AUTH_URL}${COVER_PATH}${userId}?v=${at.getTime()}`
export const isOwnCoverUrl = (value: string, userId: string) =>
  value.trim().startsWith(`${env.BETTER_AUTH_URL}${COVER_PATH}${userId}?`)
