import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { multiSession } from 'better-auth/plugins'
import { db } from './core/db'
import { env } from './core/env'
import { authSchema } from './core/schema'

// ponytail: defer auth construction to first use so the worker can
// serve health routes even if Better Auth secrets are missing.
// Move to eager init when startup profiling shows a bottleneck.

let _auth: ReturnType<typeof betterAuth> | null = null

const initAuth = () => {
  if (_auth) return _auth
  const isHttpsAuthUrl = env.BETTER_AUTH_URL.startsWith('https://')
  _auth = betterAuth({
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
      useSecureCookies: isHttpsAuthUrl,
      crossOrigin: true,
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: isHttpsAuthUrl,
        httpOnly: true,
      },
    },
    emailAndPassword: {
      enabled: true,
    },
  })
  return _auth
}

export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_, key: string | symbol) {
    return Reflect.get(initAuth(), key)
  },
})
