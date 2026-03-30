import { and, asc, eq, sql } from 'drizzle-orm'

import type { ReleaseSummary } from './types'

import { fetchBillboard200Albums } from './charts'
import { db } from './db'
import { getFeaturedReleases, getRecentPopularReleases, searchReleases } from './discogs'
import { storedTrendingAlbum } from './schema'

type StoredMode = 'featured' | 'recent-popular'

const DEFAULT_MODE: StoredMode = 'featured'
const MAX_LIMIT = 50

export const isStoredTrendingTableMissingError = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message : String(error ?? '')
  return code === '42P01' || message.includes('relation "stored_trending_album" does not exist')
}

const clampLimit = (value: number, fallback = 24) => {
  const safe = Number.isFinite(value) ? value : fallback
  return Math.min(Math.max(Math.round(safe), 1), MAX_LIMIT)
}

const toDateOrNull = (value: unknown) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const normalizeRelease = (release: ReleaseSummary): ReleaseSummary => ({
  id: String(release.id ?? '').trim(),
  name: String(release.name ?? 'Untitled').trim() || 'Untitled',
  artists: Array.isArray(release.artists) ? release.artists.filter(Boolean).map(String) : [],
  releaseDate: release.releaseDate ?? null,
  releaseYear: Number.isFinite(Number(release.releaseYear)) ? Number(release.releaseYear) : null,
  cover: String(release.cover ?? '').trim(),
  totalTracks: Number.isFinite(Number(release.totalTracks)) ? Math.max(0, Math.round(Number(release.totalTracks))) : 0,
  albumType: String(release.albumType ?? 'Release').trim() || 'Release',
  label: release.label ? String(release.label).trim() : undefined,
  popularity: Number.isFinite(Number(release.popularity)) ? Math.max(0, Math.round(Number(release.popularity))) : 0,
  external_urls: {
    discogs: release.external_urls?.discogs ? String(release.external_urls.discogs).trim() : undefined,
  },
  genres: Array.isArray(release.genres) ? release.genres.filter(Boolean).map(String) : [],
  communityRating: Number.isFinite(Number(release.communityRating)) ? Number(release.communityRating) : 0,
  reviewCount: Number.isFinite(Number(release.reviewCount)) ? Math.max(0, Math.round(Number(release.reviewCount))) : 0,
})

const normalizeMatchValue = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const pickBestDiscogsMatch = (
  results: ReleaseSummary[],
  target: {
    name: string
    artist: string
  },
) => {
  const targetName = normalizeMatchValue(target.name)
  const targetArtist = normalizeMatchValue(target.artist)

  const scored = results
    .map((release) => {
      const releaseName = normalizeMatchValue(release.name)
      const primaryArtist = normalizeMatchValue(release.artists?.[0] ?? '')
      let score = 0

      if (releaseName === targetName) score += 100
      else if (releaseName.includes(targetName) || targetName.includes(releaseName)) score += 60

      if (primaryArtist === targetArtist) score += 80
      else if (primaryArtist.includes(targetArtist) || targetArtist.includes(primaryArtist)) score += 40

      score += Math.min(Number(release.popularity ?? 0) / 100, 20)
      score += Math.min(Number(release.reviewCount ?? 0) / 20, 10)

      return { release, score }
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best || best.score < 80) return null
  return best.release
}

const getMostHappeningAlbums = async (limit = 12) => {
  const chartAlbums = await fetchBillboard200Albums(limit)
  const matches: ReleaseSummary[] = []

  for (const chartAlbum of chartAlbums) {
    const query = `${chartAlbum.artist} ${chartAlbum.name}`.trim()
    try {
      const result = await searchReleases(query)
      const bestMatch = pickBestDiscogsMatch(result.data, chartAlbum)
      if (bestMatch) matches.push(bestMatch)
    } catch {
      // Ignore individual chart lookup failures so the rest of the snapshot can still refresh.
    }
  }

  return Array.from(new Map(matches.map((release) => [release.id, release])).values()).slice(0, limit)
}

const getSourceSnapshotByMode = async (mode: StoredMode, limit: number) => {
  if (mode === 'recent-popular') {
    return getRecentPopularReleases(limit, true)
  }

  return getMostHappeningAlbums(limit)
}

const upsertStoredSnapshot = async (mode: StoredMode, snapshot: ReleaseSummary[]) => {
  const refreshedAt = new Date()

  if (!snapshot.length) {
    return { refreshedAt, insertedOrUpdated: 0, data: [] as ReleaseSummary[] }
  }

  await db
    .insert(storedTrendingAlbum)
    .values(
      snapshot.map((release, index) => {
        const normalized = normalizeRelease(release)
        return {
          mode,
          albumId: normalized.id,
          rank: index,
          name: normalized.name,
          artists: normalized.artists,
          releaseDate: normalized.releaseDate,
          releaseYear: normalized.releaseYear,
          cover: normalized.cover,
          totalTracks: normalized.totalTracks,
          albumType: normalized.albumType,
          label: normalized.label,
          popularity: normalized.popularity,
          externalUrls: normalized.external_urls,
          genres: normalized.genres,
          communityRating: normalized.communityRating,
          reviewCount: normalized.reviewCount,
          firstSeenAt: refreshedAt,
          lastSeenAt: refreshedAt,
          createdAt: refreshedAt,
          updatedAt: refreshedAt,
        }
      }),
    )
    .onConflictDoUpdate({
      target: [storedTrendingAlbum.mode, storedTrendingAlbum.albumId],
      set: {
        rank: sql.raw(`excluded."${storedTrendingAlbum.rank.name}"`),
        name: sql.raw(`excluded."${storedTrendingAlbum.name.name}"`),
        artists: sql.raw(`excluded."${storedTrendingAlbum.artists.name}"`),
        releaseDate: sql.raw(`excluded."${storedTrendingAlbum.releaseDate.name}"`),
        releaseYear: sql.raw(`excluded."${storedTrendingAlbum.releaseYear.name}"`),
        cover: sql.raw(`excluded."${storedTrendingAlbum.cover.name}"`),
        totalTracks: sql.raw(`excluded."${storedTrendingAlbum.totalTracks.name}"`),
        albumType: sql.raw(`excluded."${storedTrendingAlbum.albumType.name}"`),
        label: sql.raw(`excluded."${storedTrendingAlbum.label.name}"`),
        popularity: sql.raw(`excluded."${storedTrendingAlbum.popularity.name}"`),
        externalUrls: sql.raw(`excluded."${storedTrendingAlbum.externalUrls.name}"`),
        genres: sql.raw(`excluded."${storedTrendingAlbum.genres.name}"`),
        communityRating: sql.raw(`excluded."${storedTrendingAlbum.communityRating.name}"`),
        reviewCount: sql.raw(`excluded."${storedTrendingAlbum.reviewCount.name}"`),
        lastSeenAt: refreshedAt,
        updatedAt: refreshedAt,
      },
    })

  return { refreshedAt, insertedOrUpdated: snapshot.length, data: snapshot }
}

export const getStoredTrendingAlbums = async (limit = 24, mode: StoredMode = DEFAULT_MODE) => {
  const safeLimit = clampLimit(limit)
  const latestSnapshot = await db
    .select({
      lastSeenAt: sql<Date | null>`max(${storedTrendingAlbum.lastSeenAt})`,
    })
    .from(storedTrendingAlbum)
    .where(eq(storedTrendingAlbum.mode, mode))

  const snapshotAt = toDateOrNull(latestSnapshot[0]?.lastSeenAt)
  if (!snapshotAt) return []

  const rows = await db
    .select()
    .from(storedTrendingAlbum)
    .where(and(eq(storedTrendingAlbum.mode, mode), eq(storedTrendingAlbum.lastSeenAt, snapshotAt)))
    .orderBy(asc(storedTrendingAlbum.rank))
    .limit(safeLimit)

  return rows.map(
    (row): ReleaseSummary => ({
      id: row.albumId,
      name: row.name,
      artists: Array.isArray(row.artists) ? row.artists : [],
      releaseDate: row.releaseDate ?? null,
      releaseYear: row.releaseYear ?? null,
      cover: row.cover,
      totalTracks: row.totalTracks,
      albumType: row.albumType,
      label: row.label ?? undefined,
      popularity: row.popularity,
      external_urls: row.externalUrls ?? {},
      genres: Array.isArray(row.genres) ? row.genres : [],
      communityRating: Number(row.communityRating ?? 0),
      reviewCount: row.reviewCount,
    }),
  )
}

export const refreshStoredTrendingAlbums = async (mode: StoredMode = DEFAULT_MODE, limit = 24) => {
  const safeLimit = clampLimit(limit)
  const snapshot = await getSourceSnapshotByMode(mode, safeLimit)
  return upsertStoredSnapshot(mode, snapshot)
}

export const refreshStoredHomeAlbums = async (params?: { happeningLimit?: number; recentLimit?: number }) => {
  const happeningLimit = clampLimit(params?.happeningLimit ?? 12, 12)
  const recentLimit = clampLimit(params?.recentLimit ?? 24, 24)

  const [mostHappening, recentReleases] = await Promise.all([
    refreshStoredTrendingAlbums('featured', happeningLimit),
    refreshStoredTrendingAlbums('recent-popular', recentLimit),
  ])

  return {
    mostHappening,
    recentReleases,
  }
}

export const getFeaturedFallbackReleases = async (limit = 24) => getFeaturedReleases(limit)
