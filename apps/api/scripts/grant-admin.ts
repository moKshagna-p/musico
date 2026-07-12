import { eq } from 'drizzle-orm'

import { db } from '../src/core/db'
import { adminUser, user } from '../src/core/schema'

const email = String(process.argv[2] ?? '').trim().toLowerCase()

if (!email) {
  throw new Error('Usage: bun run admin:grant -- user@example.com')
}

const [target] = await db
  .select({ id: user.id, email: user.email })
  .from(user)
  .where(eq(user.email, email))
  .limit(1)

if (!target) {
  throw new Error(`No user exists for ${email}. Sign in once before granting access.`)
}

await db
  .insert(adminUser)
  .values({
    userId: target.id,
    grantedByUserId: null,
    createdAt: new Date(),
  })
  .onConflictDoNothing()

console.log(`Admin access granted to ${target.email}.`)
