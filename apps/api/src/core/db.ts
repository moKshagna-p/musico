import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import { env } from './env'

// ponytail: defer DB connection to first query so the worker can start
// and serve health routes even when DATABASE_URL is misconfigured.
// Move to eager init when cold-start profiling shows a bottleneck.

let _db: ReturnType<typeof drizzle> | null = null

const getDb = () => {
  if (!_db) _db = drizzle(neon(env.DATABASE_URL))
  return _db
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, key: string | symbol) {
    return Reflect.get(getDb(), key)
  },
})
