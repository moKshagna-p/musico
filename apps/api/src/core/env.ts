const globalEnv = globalThis as unknown as {
  Bun?: { env: Record<string, string | undefined> }
  __MUSICO_WORKER_ENV__?: Record<string, string | undefined>
}

const getRawEnv = () =>
  (globalEnv.__MUSICO_WORKER_ENV__ ?? globalEnv.Bun?.env ?? process.env ?? {}) as Record<string, string | undefined>

const readEnv = (key: string) => getRawEnv()[key]?.trim()

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

const DISCOGS_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 5 + 1000 * 60 * 55
const parseDiscogsCacheTtl = (value: string | undefined) =>
  Math.min(parsePositiveInteger(value, DISCOGS_CACHE_MAX_AGE_MS), DISCOGS_CACHE_MAX_AGE_MS)

const parseOrigins = (value: string | undefined, fallback: string) =>
  (value ?? fallback)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

// ponytail: Proxy defers env validation to first property access
// so the worker can serve health-check routes even if secrets
// aren't configured yet. Add eager validation when startup profiling shows need.
const get = (key: string): string | undefined => getRawEnv()[key]?.trim()

export const env = new Proxy({} as Record<string, unknown>, {
  get(_, key: string) {
    switch (key) {
      case 'PORT': return parsePositiveInteger(get('PORT'), 4000)
      case 'DATABASE_URL': return requireEnv('DATABASE_URL')
      case 'BETTER_AUTH_URL': return requireEnv('BETTER_AUTH_URL')
      case 'BETTER_AUTH_SECRET': return requireEnv('BETTER_AUTH_SECRET')
      case 'ALLOWED_ORIGINS': return parseOrigins(get('ALLOWED_ORIGIN'), 'http://localhost:5173')
      case 'DISCOGS_TOKEN': return sanitizeOptionalSecret(get('DISCOGS_TOKEN'))
      case 'DISCOGS_KEY': return sanitizeOptionalSecret(get('DISCOGS_KEY'))
      case 'DISCOGS_SECRET': return sanitizeOptionalSecret(get('DISCOGS_SECRET'))
      case 'DISCOGS_USER_AGENT': return get('DISCOGS_USER_AGENT') || 'musico/1.0 (+https://example.com)'
      case 'FEATURED_CACHE_TTL_MS': return parseDiscogsCacheTtl(get('FEATURED_CACHE_TTL_MS'))
      case 'SEARCH_CACHE_TTL_MS': return parseDiscogsCacheTtl(get('SEARCH_CACHE_TTL_MS'))
      case 'FEATURED_RETRY_COOLDOWN_MS': return parsePositiveInteger(get('FEATURED_RETRY_COOLDOWN_MS'), 1000 * 60 * 10)
      case 'SEARCH_RETRY_COOLDOWN_MS': return parsePositiveInteger(get('SEARCH_RETRY_COOLDOWN_MS'), 1000 * 60 * 10)
      case 'FEATURED_DETAIL_HYDRATION_LIMIT': return parsePositiveInteger(get('FEATURED_DETAIL_HYDRATION_LIMIT'), 12)
      case 'SEARCH_MAX_PAGES': return parsePositiveInteger(get('SEARCH_MAX_PAGES'), 4)
      case 'SEARCH_QUERY_PAGES': return parsePositiveInteger(get('SEARCH_QUERY_PAGES'), 3)
      case 'SEARCH_MIN_RESULTS_BEFORE_PAGING': return parsePositiveInteger(get('SEARCH_MIN_RESULTS_BEFORE_PAGING'), 60)
      case 'DISCOGS_MIN_REQUEST_INTERVAL_MS': return parsePositiveInteger(get('DISCOGS_MIN_REQUEST_INTERVAL_MS'), 1100)
      case 'DISCOGS_MAX_RETRIES': return parsePositiveInteger(get('DISCOGS_MAX_RETRIES'), 4)
      case 'DISCOGS_REQUEST_TIMEOUT_MS': return parsePositiveInteger(get('DISCOGS_REQUEST_TIMEOUT_MS'), 10000)
      case 'HOME_RELEASE_DETAILS_PREWARM_LIMIT': return parsePositiveInteger(get('HOME_RELEASE_DETAILS_PREWARM_LIMIT'), 6)
      case 'HOMEPAGE_REFRESH_MINIMAL': return get('HOMEPAGE_REFRESH_MINIMAL') !== 'false'
      case 'RELEASE_CACHE_MAX_ENTRIES': return parsePositiveInteger(get('RELEASE_CACHE_MAX_ENTRIES'), 1500)
      case 'CRON_SECRET': return sanitizeOptionalSecret(get('CRON_SECRET'))
      default: return undefined
    }
  },
}) as {
  PORT: number
  DATABASE_URL: string
  BETTER_AUTH_URL: string
  BETTER_AUTH_SECRET: string
  ALLOWED_ORIGINS: string[]
  DISCOGS_TOKEN: string | undefined
  DISCOGS_KEY: string | undefined
  DISCOGS_SECRET: string | undefined
  DISCOGS_USER_AGENT: string
  FEATURED_CACHE_TTL_MS: number
  SEARCH_CACHE_TTL_MS: number
  FEATURED_RETRY_COOLDOWN_MS: number
  SEARCH_RETRY_COOLDOWN_MS: number
  FEATURED_DETAIL_HYDRATION_LIMIT: number
  SEARCH_MAX_PAGES: number
  SEARCH_QUERY_PAGES: number
  SEARCH_MIN_RESULTS_BEFORE_PAGING: number
  DISCOGS_MIN_REQUEST_INTERVAL_MS: number
  DISCOGS_MAX_RETRIES: number
  DISCOGS_REQUEST_TIMEOUT_MS: number
  HOME_RELEASE_DETAILS_PREWARM_LIMIT: number
  HOMEPAGE_REFRESH_MINIMAL: boolean
  RELEASE_CACHE_MAX_ENTRIES: number
  CRON_SECRET: string | undefined
}

export const readOptionalSecret = (key: string) => sanitizeOptionalSecret(get(key))

export const validateProductionEnv = () => {
  if (!env.ALLOWED_ORIGINS.length) {
    throw new Error('Missing required environment variable: ALLOWED_ORIGIN')
  }

  if (!env.DISCOGS_TOKEN && !(env.DISCOGS_KEY && env.DISCOGS_SECRET)) {
    throw new Error('Missing Discogs credentials. Set DISCOGS_TOKEN or both DISCOGS_KEY and DISCOGS_SECRET.')
  }

  return env
}
