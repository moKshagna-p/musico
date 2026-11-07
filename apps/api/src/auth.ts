import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { customSession, multiSession } from 'better-auth/plugins'
import { toAvatarUrl } from './core/avatar'
import { db } from './core/db'
import { env } from './core/env'
import { authSchema } from './core/schema'

// ponytail: defer auth construction to first use so the worker can
// serve health routes even if Better Auth secrets are missing.
// Move to eager init when startup profiling shows a bottleneck.

const createAuth = () => {
  const isHttpsAuthUrl = env.BETTER_AUTH_URL.startsWith('https://')
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: authSchema,
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    // musico:// is the mobile app (apps/mobile); expo() maps its expo-origin header to Origin.
    trustedOrigins: [...env.ALLOWED_ORIGINS, 'musico://'],
    // ponytail: no session cookieCache: it copies the user row into cookies, and user.image holds
    // data-URL avatars (up to ~2.8MB), so Vercel 502s the sign-in response. Re-enable once avatars move out of the user row.
    plugins: [
      expo(),
      multiSession({
        maximumSessions: 1,
      }),
      // Keep inline avatars out of every session response; the app links to /api/avatars instead.
      customSession(async ({ user, session }) => ({ user: { ...user, image: toAvatarUrl(user) }, session })),
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
    // Read session + user in one query instead of two round trips; needs core/relations.ts.
    experimental: {
      joins: true,
    },
  })
}

let _auth: ReturnType<typeof createAuth> | null = null
const initAuth = () => (_auth ??= createAuth())

export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get(_, key: string | symbol) {
    return Reflect.get(initAuth(), key)
  },
})
