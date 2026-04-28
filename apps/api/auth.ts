import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { multiSession } from 'better-auth/plugins'
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
  plugins: [
    multiSession({
      maximumSessions: 1,
    }),
  ],
  advanced: {
    // Vercel Proxy -> Railway API flow.
    useSecureCookies: isHttpsAuthUrl,
    crossOrigin: true,
    defaultCookieAttributes: {
      // With the proxy, we are technically same-site, so 'lax' is safer and better for Safari.
      sameSite: 'lax',
      secure: isHttpsAuthUrl,
      httpOnly: true,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
})
