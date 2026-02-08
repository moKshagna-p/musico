import { Database } from 'bun:sqlite'
import { betterAuth } from 'better-auth'

const env = ((globalThis as unknown as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env ??
  process.env ??
  {}) as Record<string, string | undefined>

const baseUrl = env.BETTER_AUTH_URL ?? `http://localhost:${env.PORT ?? '4000'}`
const allowedOrigins = (env.ALLOWED_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const db = new Database('./auth.db')

export const auth = betterAuth({
  database: db,
  baseURL: baseUrl,
  trustedOrigins: allowedOrigins,
  emailAndPassword: {
    enabled: true,
  },
})
