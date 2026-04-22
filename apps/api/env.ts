const globalEnv = globalThis as unknown as {
  Bun?: { env: Record<string, string | undefined> }
  __MUSICO_WORKER_ENV__?: Record<string, string | undefined>
}

const rawEnv = (globalEnv.__MUSICO_WORKER_ENV__ ?? globalEnv.Bun?.env ?? process.env ?? {}) as Record<string, string | undefined>

const readEnv = (key: string) => rawEnv[key]?.trim()

const isPlaceholder = (value: string) => /^(your_|replace_|example|changeme|token_here|key_here|secret_here)/i.test(value)

const requireEnv = (key: string) => {
  const value = readEnv(key)
  if (!value || isPlaceholder(value)) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

const sanitizeOptionalSecret = (value?: string) => {
  if (!value) return undefined
  return isPlaceholder(value) ? undefined : value
}

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseOrigins = (value: string | undefined, fallback: string) =>
  (value ?? fallback)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

export const env = {
  PORT: parsePositiveInteger(readEnv('PORT'), 4000),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  BETTER_AUTH_URL: requireEnv('BETTER_AUTH_URL'),
  BETTER_AUTH_SECRET: requireEnv('BETTER_AUTH_SECRET'),
  ALLOWED_ORIGINS: parseOrigins(readEnv('ALLOWED_ORIGIN'), 'http://localhost:5173'),
  DISCOGS_TOKEN: sanitizeOptionalSecret(readEnv('DISCOGS_TOKEN')),
  DISCOGS_KEY: sanitizeOptionalSecret(readEnv('DISCOGS_KEY')),
  DISCOGS_SECRET: sanitizeOptionalSecret(readEnv('DISCOGS_SECRET')),
  DISCOGS_USER_AGENT: readEnv('DISCOGS_USER_AGENT') || 'musico/1.0 (+https://example.com)',
  FEATURED_CACHE_TTL_MS: parsePositiveInteger(readEnv('FEATURED_CACHE_TTL_MS'), 1000 * 60 * 60 * 24 * 7),
  SEARCH_CACHE_TTL_MS: parsePositiveInteger(readEnv('SEARCH_CACHE_TTL_MS'), 1000 * 60 * 60 * 24 * 7),
  FEATURED_RETRY_COOLDOWN_MS: parsePositiveInteger(readEnv('FEATURED_RETRY_COOLDOWN_MS'), 1000 * 60 * 10),
  SEARCH_RETRY_COOLDOWN_MS: parsePositiveInteger(readEnv('SEARCH_RETRY_COOLDOWN_MS'), 1000 * 60 * 10),
  FEATURED_DETAIL_HYDRATION_LIMIT: parsePositiveInteger(readEnv('FEATURED_DETAIL_HYDRATION_LIMIT'), 12),
  SEARCH_MAX_PAGES: parsePositiveInteger(readEnv('SEARCH_MAX_PAGES'), 4),
  SEARCH_QUERY_PAGES: parsePositiveInteger(readEnv('SEARCH_QUERY_PAGES'), 3),
  SEARCH_MIN_RESULTS_BEFORE_PAGING: parsePositiveInteger(readEnv('SEARCH_MIN_RESULTS_BEFORE_PAGING'), 60),
  DISCOGS_MIN_REQUEST_INTERVAL_MS: parsePositiveInteger(readEnv('DISCOGS_MIN_REQUEST_INTERVAL_MS'), 1100),
  DISCOGS_MAX_RETRIES: parsePositiveInteger(readEnv('DISCOGS_MAX_RETRIES'), 4),
  HOME_RELEASE_DETAILS_PREWARM_LIMIT: parsePositiveInteger(readEnv('HOME_RELEASE_DETAILS_PREWARM_LIMIT'), 6),
  RELEASE_CACHE_MAX_ENTRIES: parsePositiveInteger(readEnv('RELEASE_CACHE_MAX_ENTRIES'), 1500),
  CRON_SECRET: sanitizeOptionalSecret(readEnv('CRON_SECRET')),
} as const

export const hasEnv = (key: string) => Boolean(sanitizeOptionalSecret(readEnv(key)))

export const validateProductionEnv = () => {
  if (!env.ALLOWED_ORIGINS.length) {
    throw new Error('Missing required environment variable: ALLOWED_ORIGIN')
  }

  if (!env.DISCOGS_TOKEN && !(env.DISCOGS_KEY && env.DISCOGS_SECRET)) {
    throw new Error('Missing Discogs credentials. Set DISCOGS_TOKEN or both DISCOGS_KEY and DISCOGS_SECRET.')
  }

  return env
}
