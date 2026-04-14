import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { db } from './db'
import { env } from './env'
import { authSchema } from './schema'

const isHttpsAuthUrl = env.BETTER_AUTH_URL.startsWith('https://')

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.ALLOWED_ORIGINS,
  advanced: {
    // Vercel frontend -> Railway API is a cross-site cookie flow in production.
    useSecureCookies: isHttpsAuthUrl,
    crossOrigin: true,
    defaultCookieAttributes: {
      sameSite: isHttpsAuthUrl ? 'none' : 'lax',
      secure: isHttpsAuthUrl,
      httpOnly: true,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
})
