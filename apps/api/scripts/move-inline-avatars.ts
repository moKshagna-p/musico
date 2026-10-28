import { like, sql } from 'drizzle-orm'

import { avatarPath, parseInlineAvatar } from '../src/core/avatar'
import { db } from '../src/core/db'
import { user } from '../src/core/schema'

// Moves inline data-URL avatars from user.image into user_avatar. Safe to re-run: moved rows no longer match.
const dryRun = process.argv.includes('--dry-run')

const rows = await db.select({ id: user.id, image: user.image }).from(user).where(like(user.image, 'data:image/%'))
const avatars = rows.flatMap((row) => {
  const avatar = parseInlineAvatar(row.image)
  return avatar ? [{ id: row.id, image: row.image!, avatar }] : []
})
const totalKb = Math.round(avatars.reduce((sum, { avatar }) => sum + avatar.data.length, 0) / 1024)

console.log(`${avatars.length} inline avatar(s) to move (${totalKb} KB base64); ${rows.length - avatars.length} other data URL(s) left inline.`)
if (dryRun) process.exit(0)

let moved = 0
for (const { id, image, avatar } of avatars) {
  const now = new Date()
  // One statement: the link only changes if the user still has the image read above, and the bytes only move with it.
  // A user who uploaded or removed an avatar since then is left alone.
  const result = await db.execute(sql`
    with relinked as (
      update "user" set "image" = ${avatarPath(id, now)}, "updatedAt" = ${now.toISOString()}
      where "id" = ${id} and "image" = ${image}
      returning "id"
    )
    insert into "user_avatar" ("userId", "contentType", "data", "updatedAt")
    select "id", ${avatar.contentType}, ${avatar.data}, ${now.toISOString()} from relinked
    on conflict ("userId") do update set "contentType" = excluded."contentType", "data" = excluded."data", "updatedAt" = excluded."updatedAt"`)
  moved += result.rowCount ?? 0
}

console.log(`Moved ${moved} of ${avatars.length} avatar(s); the rest changed since they were read.`)
