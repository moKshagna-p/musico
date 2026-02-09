import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { db } from './db'
import { authSchema } from './schema'

const env = ((globalThis as unknown as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env ??
  process.env ??
  {}) as Record<string, string | undefined>

const baseUrl = env.BETTER_AUTH_URL ?? `http://localhost:${env.PORT ?? '4000'}`
const allowedOrigins = (env.ALLOWED_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  baseURL: baseUrl,
  trustedOrigins: allowedOrigins,
  emailAndPassword: {
    enabled: true,
  },
})
