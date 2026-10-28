import { eq, like } from 'drizzle-orm'

import { avatarPath, parseInlineAvatar } from '../src/core/avatar'
import { db } from '../src/core/db'
import { user, userAvatar } from '../src/core/schema'

// Moves inline data-URL avatars from user.image into user_avatar. Safe to re-run: moved rows no longer match.
const dryRun = process.argv.includes('--dry-run')

const rows = await db.select({ id: user.id, image: user.image }).from(user).where(like(user.image, 'data:image/%'))
const avatars = rows.flatMap((row) => {
  const avatar = parseInlineAvatar(row.image)
  return avatar ? [{ id: row.id, avatar }] : []
})
const totalKb = Math.round(avatars.reduce((sum, { avatar }) => sum + avatar.data.length, 0) / 1024)

console.log(`${avatars.length} inline avatar(s) to move (${totalKb} KB base64); ${rows.length - avatars.length} other data URL(s) left inline.`)
if (dryRun) process.exit(0)

for (const { id, avatar } of avatars) {
  const now = new Date()
  const values = { userId: id, ...avatar, updatedAt: now }
  await db.insert(userAvatar).values(values).onConflictDoUpdate({ target: userAvatar.userId, set: values })
  await db.update(user).set({ image: avatarPath(id, now), updatedAt: now }).where(eq(user.id, id))
}

console.log(`Moved ${avatars.length} avatar(s).`)
