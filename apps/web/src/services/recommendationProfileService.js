import { inferGenresFromSeed } from './ratingsService.js'

const GENRE_PROFILE_KEY_PREFIX = 'musico:genre-profile'
const MAX_GENRE_EVENTS = 30

const isBrowser = typeof window !== 'undefined'

const normalizeScope = (scope) => String(scope ?? '').trim().toLowerCase()
const getStorageKey = (scope) => `${GENRE_PROFILE_KEY_PREFIX}:${normalizeScope(scope)}`

const readEvents = (scope) => {
  if (!isBrowser) return []
  const normalized = normalizeScope(scope)
  if (!normalized) return []

  try {
    const raw = window.localStorage.getItem(getStorageKey(normalized))
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((entry) => entry && typeof entry.genre === 'string' && Number.isFinite(Number(entry.timestamp)))
      .map((entry) => ({
        genre: entry.genre.trim(),
        timestamp: Number(entry.timestamp),
      }))
      .filter((entry) => entry.genre)
  } catch {
    return []
  }
}

const writeEvents = (scope, events) => {
  if (!isBrowser) return
  const normalized = normalizeScope(scope)
  if (!normalized) return

  try {
    window.localStorage.setItem(getStorageKey(normalized), JSON.stringify(events.slice(0, MAX_GENRE_EVENTS)))
  } catch {
    // Ignore storage failures.
  }
}

const extractGenres = (album) => {
  if (Array.isArray(album?.genres) && album.genres.length) {
    return album.genres.map((genre) => String(genre ?? '').trim()).filter(Boolean)
  }

  return inferGenresFromSeed(album)
}

export const trackOpenedAlbumGenres = ({ album, scope }) => {
  const normalized = normalizeScope(scope)
  if (!normalized || !album) return

  const genres = extractGenres(album)
  if (!genres.length) return

  const now = Date.now()
  const existing = readEvents(normalized)
  const next = [
    ...genres.slice(0, 3).map((genre) => ({ genre, timestamp: now })),
    ...existing,
  ]

  writeEvents(normalized, next)
}

export const getTopGenresForRecommendations = (scope, limit = 3) => {
  const normalized = normalizeScope(scope)
  if (!normalized) return []

  const events = readEvents(normalized)
  if (!events.length) return []

  const now = Date.now()
  const scores = new Map()

  events.forEach((entry) => {
    const ageHours = Math.max(0, (now - entry.timestamp) / (1000 * 60 * 60))
    const recencyWeight = 1 / (1 + ageHours / 24)
    const previous = scores.get(entry.genre) ?? 0
    scores.set(entry.genre, previous + recencyWeight)
  })

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, limit))
    .map(([genre]) => genre)
}
