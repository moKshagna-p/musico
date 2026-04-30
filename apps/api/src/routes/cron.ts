import { Elysia } from 'elysia'
import { env } from '../core/env'
import { authorizeCron } from '../core/utils'
import {
  refreshStoredHomeAlbums,
  refreshStoredTrendingAlbums,
  isStoredTrendingTableMissingError,
} from '../services/trending'

export const cronRoutes = new Elysia({ prefix: '/api/cron' })
  .get('/home-refresh', async ({ query, request, set }) => {
    const authError = authorizeCron(request, set)
    if (authError) return authError

    try {
      const happeningLimitParam = Number(query?.happeningLimit)
      const recentLimitParam = Number(query?.recentLimit)
      const mode = String(query?.mode ?? 'all').toLowerCase()
      const defaultLimit = env.HOMEPAGE_REFRESH_MINIMAL ? 6 : 24
      const happeningLimit = Number.isFinite(happeningLimitParam)
        ? Math.min(Math.max(happeningLimitParam, 1), 50)
        : defaultLimit
      const recentLimit = Number.isFinite(recentLimitParam)
        ? Math.min(Math.max(recentLimitParam, 1), 50)
        : defaultLimit

      if (mode === 'featured' || mode === 'recent-popular') {
        const limit = mode === 'featured' ? happeningLimit : recentLimit
        const result = await refreshStoredTrendingAlbums(mode, limit)
        set.headers ??= {}
        set.headers['Cache-Control'] = 'no-store'
        return {
          ok: true,
          refreshedAt: new Date().toISOString(),
          mode,
          insertedOrUpdated: result.insertedOrUpdated,
          snapshotSize: result.data.length,
          snapshotRefreshedAt: result.refreshedAt.toISOString(),
        }
      }

      const result = await refreshStoredHomeAlbums({ happeningLimit, recentLimit })
      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return {
        ok: true,
        refreshedAt: new Date().toISOString(),
        mostHappening: {
          insertedOrUpdated: result.mostHappening.insertedOrUpdated,
          snapshotSize: result.mostHappening.data.length,
          refreshedAt: result.mostHappening.refreshedAt.toISOString(),
        },
        recentReleases: {
          insertedOrUpdated: result.recentReleases.insertedOrUpdated,
          snapshotSize: result.recentReleases.data.length,
          refreshedAt: result.recentReleases.refreshedAt.toISOString(),
        },
      }
    } catch (error) {
      if (isStoredTrendingTableMissingError(error)) {
        set.status = 503
        return {
          error:
            'stored_trending_album table is missing. Run the latest database migration first.',
        }
      }
      console.error('[cron.home-refresh] error', error)
      set.status = 502
      return { error: 'Unable to refresh stored homepage releases right now.' }
    }
  })
  .get('/recent-releases-refresh', async ({ query, request, set }) => {
    const authError = authorizeCron(request, set)
    if (authError) return authError

    try {
      const limitParam = Number(query?.limit)
      const limit = Number.isFinite(limitParam)
        ? Math.min(Math.max(limitParam, 1), 50)
        : 24
      const result = await refreshStoredTrendingAlbums('recent-popular', limit)
      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return {
        ok: true,
        mode: 'recent-popular',
        insertedOrUpdated: result.insertedOrUpdated,
        snapshotSize: result.data.length,
        refreshedAt: result.refreshedAt.toISOString(),
      }
    } catch (error) {
      if (isStoredTrendingTableMissingError(error)) {
        set.status = 503
        return {
          error:
            'stored_trending_album table is missing. Run the latest database migration first.',
        }
      }
      console.error('[cron.recent-releases-refresh] error', error)
      set.status = 502
      return { error: 'Unable to refresh stored recent releases right now.' }
    }
  })
