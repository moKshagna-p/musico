// A Postgres cache in front of rate-limited services, shared by every worker isolate. Each service keeps its
// in-memory cache as the first layer; this one stops a cold isolate from repeating a lookup another already made,
// and a pause after a 429 holds for all isolates instead of only the one that was told to slow down.
// Failures read as misses: caching is never worth failing the request it sits in front of.

import { and, eq, gt, lt } from 'drizzle-orm'

import { db } from './db'
import { sharedCache } from './schema'

const warn = (action: string, error: unknown) =>
  console.warn(`[shared-cache] ${action} failed`, error instanceof Error ? error.message : String(error))

// Values are wrapped so a cached null ("no logo for this artist") is a hit, not a miss.
export const sharedGet = async <T>(key: string): Promise<{ value: T } | null> => {
  try {
    const [row] = await db
      .select({ value: sharedCache.value })
      .from(sharedCache)
      .where(and(eq(sharedCache.key, key), gt(sharedCache.expiresAt, new Date())))
      .limit(1)
    return row ? { value: row.value.v as T } : null
  } catch (error) {
    warn('read', error)
    return null
  }
}

export const sharedSet = async (key: string, value: unknown, ttlMs: number) => {
  const row = { key, value: { v: value }, expiresAt: new Date(Date.now() + ttlMs) }
  try {
    await db
      .insert(sharedCache)
      .values(row)
      .onConflictDoUpdate({ target: sharedCache.key, set: { value: row.value, expiresAt: row.expiresAt } })
  } catch (error) {
    warn('write', error)
  }
}

export const pauseService = (service: string, ms: number) => sharedSet(`pause:${service}`, true, ms)
export const isServicePaused = async (service: string) => Boolean(await sharedGet(`pause:${service}`))

// Run from the cron so dead keys (one per album, artist or GIF search) do not pile up.
export const sweepSharedCache = () => db.delete(sharedCache).where(lt(sharedCache.expiresAt, new Date()))
