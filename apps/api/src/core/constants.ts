// Per client IP across all API routes. Browsing peaks around 50 requests a minute (a page load fans out to ~10),
// so this only stops scripted hammering.
export const RATE_LIMIT_WINDOW = 1000 * 60
export const RATE_LIMIT_MAX = 300
export const RATE_LIMIT_MAX_TRACKED_IPS = 10000
export const MAX_LISTS_PER_USER = 30
export const MAX_ALBUMS_PER_LIST = 200
export const MAX_REVIEW_LENGTH = 280
export const MAX_BIO_LENGTH = 160
export const MAX_RELEASE_PREVIEW_LOOKUPS = 36
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/
