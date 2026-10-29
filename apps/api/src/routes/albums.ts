import { Elysia, t } from 'elysia'
import { getReleaseDetails } from '../services/discogs'
import { attachMusicoCommunityStats } from '../core/utils'
import { attachHdCovers } from '../services/albumArtwork'
import { attachDiscLabels, lookUpDiscLabelsLater } from '../services/discLabels'
import { findStreamingLinks } from '../services/streamingLinks'
import { loadStoredFeaturedSection } from '../services/trending'
import { readIdentifier } from './validation'

type Hydratable = Parameters<typeof attachHdCovers>[0][number] & { communityRating?: number; reviewCount?: number }

// Stats, covers and disc labels live in separate tables, so read them at once rather than one after the other.
const hydrate = async <T extends Hydratable>(releases: T[], options?: Parameters<typeof attachHdCovers>[1]) => {
  const [withStats, withCovers, withLabels] = await Promise.all([
    attachMusicoCommunityStats(releases),
    attachHdCovers(releases, options),
    attachDiscLabels(releases),
  ])
  return withStats.map((release, index) => ({ ...release, cover: withCovers[index].cover, discLabel: withLabels[index].discLabel }))
}

export const albumRoutes = new Elysia({ prefix: '/api' })
  .get('/featured', async ({ query, set }) => {
    try {
      const limitParam = Number(query?.limit)
      const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 24
      const mode = String(query?.mode ?? '').toLowerCase()
      const normalizedMode = mode === 'recent-popular' ? 'recent-popular' : 'featured'
      const data = await loadStoredFeaturedSection(normalizedMode, limit)

      set.headers ??= {}
      // Refresh failures come back as []; caching that would blank the page for everyone.
      set.headers['Cache-Control'] = data.length
        ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=21000'
        : 'no-store'
      return { data: await hydrate(data) }
    } catch (error) {
      console.error('[featured] error', error)
      set.status = 502
      return { error: 'Unable to load featured releases right now.' }
    }
  })
  .get('/home', async ({ query, set }) => {
    try {
      const happeningLimitParam = Number(query?.happeningLimit)
      const recentLimitParam = Number(query?.recentLimit)
      const happeningLimit = Number.isFinite(happeningLimitParam) ? Math.min(Math.max(happeningLimitParam, 1), 50) : 24
      const recentLimit = Number.isFinite(recentLimitParam) ? Math.min(Math.max(recentLimitParam, 1), 50) : 24

      const [mostHappening, recentReleases] = await Promise.allSettled([
        loadStoredFeaturedSection('featured', happeningLimit),
        loadStoredFeaturedSection('recent-popular', recentLimit),
      ])

      const happeningAlbums = mostHappening.status === 'fulfilled' ? mostHappening.value : []
      const recentAlbums = recentReleases.status === 'fulfilled' ? recentReleases.value : []
      const hydratedAlbums = await hydrate([...happeningAlbums, ...recentAlbums])
      const mostHappeningData = hydratedAlbums.slice(0, happeningAlbums.length)
      const recentReleasesData = hydratedAlbums.slice(happeningAlbums.length)

      const allFailed = mostHappening.status === 'rejected' && recentReleases.status === 'rejected'
      if (allFailed) {
        console.warn('[home] both sections failed, returning empty data')
      }

      // Only cache fully healthy responses at the edge.
      const isHealthy =
        mostHappening.status === 'fulfilled' &&
        recentReleases.status === 'fulfilled' &&
        mostHappeningData.length > 0 &&
        recentReleasesData.length > 0

      set.headers ??= {}
      set.headers['Cache-Control'] = isHealthy
        ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=21000'
        : 'no-store'
      return {
        mostHappening: {
          data: mostHappeningData,
          ...(mostHappening.status === 'rejected'
            ? { error: 'Unable to load most happening albums.' }
            : {}),
        },
        recentReleases: {
          data: recentReleasesData,
          ...(recentReleases.status === 'rejected'
            ? { error: 'Unable to load recent releases.' }
            : {}),
        },
      }
    } catch (error) {
      console.error('[home] error', error)
      set.status = 502
      return { error: 'Unable to load homepage data right now.' }
    }
  })
  .get('/streaming-links', async ({ query, set }) => {
    set.headers ??= {}
    try {
      const links = await findStreamingLinks(query.artist, query.album)
      // An album's pages rarely move; one with none listed yet is asked about again sooner.
      set.headers['Cache-Control'] = Object.keys(links).length
        ? 'public, max-age=86400, s-maxage=2592000'
        : 'public, max-age=3600, s-maxage=86400'
      return { links }
    } catch (error) {
      // The album page keeps its search links; nothing is cached so the next visit asks again.
      console.warn('[streaming-links] lookup failed', query.artist, query.album, error instanceof Error ? error.message : String(error))
      set.status = 503
      set.headers['Cache-Control'] = 'no-store'
      return { error: 'Streaming links are unavailable right now.' }
    }
  }, {
    query: t.Object({
      artist: t.String({ minLength: 1, maxLength: 200 }),
      album: t.String({ minLength: 1, maxLength: 300 }),
    }),
  })
   .get('/releases/:id', async ({ params, set }) => {
     const releaseId = readIdentifier(params?.id)
     if (!releaseId) {
       set.status = 400
       return { error: 'Missing release id.' }
     }
     try {
       const data = await getReleaseDetails(releaseId)
       const [hydrated] = await hydrate([data], { maxLookups: 1 })
       if (!hydrated.discLabel) lookUpDiscLabelsLater([data])
       set.headers ??= {}
       // Community scores change; catalog data is cached server-side.
       set.headers['Cache-Control'] = 'no-store'
       return hydrated
     } catch (error) {
       console.error('[release] error', releaseId, error instanceof Error ? error.message : String(error), error)
       set.status = 502
       return { error: 'Unable to load release details.' }
     }
   })
