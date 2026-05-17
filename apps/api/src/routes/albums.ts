import { Elysia } from 'elysia'
import { getReleaseDetails } from '../services/discogs'
import {
  attachMusicoCommunityStats,
} from '../core/utils'
import { getStoredTrendingAlbumsEnsuringFresh } from '../services/trending'

export const albumRoutes = new Elysia({ prefix: '/api' })
  .get('/featured', async ({ query, set }) => {
    try {
      const limitParam = Number(query?.limit)
      const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 24
      const mode = String(query?.mode ?? '').toLowerCase()
      const normalizedMode = mode === 'recent-popular' ? 'recent-popular' : 'featured'
      const data = await getStoredTrendingAlbumsEnsuringFresh(limit, normalizedMode)

      set.headers ??= {}
      set.headers['Cache-Control'] = 'public, max-age=60'
      return { data: await attachMusicoCommunityStats(data) }
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
        getStoredTrendingAlbumsEnsuringFresh(happeningLimit, 'featured'),
        getStoredTrendingAlbumsEnsuringFresh(recentLimit, 'recent-popular'),
      ])

      const mostHappeningData = mostHappening.status === 'fulfilled'
        ? await attachMusicoCommunityStats(mostHappening.value)
        : []
      const recentReleasesData = recentReleases.status === 'fulfilled'
        ? await attachMusicoCommunityStats(recentReleases.value)
        : []

      const allFailed = mostHappening.status === 'rejected' && recentReleases.status === 'rejected'
      if (allFailed) set.status = 502

      set.headers ??= {}
      set.headers['Cache-Control'] = 'public, max-age=60'
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
   .get('/releases/:id', async ({ params, set }) => {
     if (!params?.id) {
       set.status = 400
       return { error: 'Missing release id.' }
     }
     try {
       const data = await getReleaseDetails(params.id)
       const [hydrated] = await attachMusicoCommunityStats([data])
       set.headers ??= {}
       set.headers['Cache-Control'] = 'public, max-age=3600, immutable'
       return hydrated
     } catch (error) {
       console.error('[release] error', error)
       set.status = 502
       return { error: 'Unable to load release details.' }
     }
   })
