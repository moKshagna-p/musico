import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

const env = ((globalThis as unknown as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env ??
  process.env ??
  {}) as Record<string, string | undefined>

const databaseUrl = env.DATABASE_URL?.trim()

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL environment variable for Neon Postgres connection.')
}

const sql = neon(databaseUrl)

export const db = drizzle(sql)
