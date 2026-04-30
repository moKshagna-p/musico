import { Elysia } from 'elysia'
import { desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '../core/db'
import { user, userProfile } from '../core/schema'
import { searchReleases } from '../services/discogs'
import { recordSearchQuery } from '../services/searchSignals'
import { attachMusicoCommunityStats } from '../core/utils'

export const searchRoutes = new Elysia()
  .get('/api/search', async ({ query, set }) => {
    const q = String(query?.q ?? '').trim()
    if (!q) {
      set.status = 400
      return { error: 'Search query is required.' }
    }

    try {
      const { data, correctedQuery } = await searchReleases(q)
      const withStats = await attachMusicoCommunityStats(data)
      return { data: withStats, correctedQuery }
    } catch (error) {
      set.status = 502
      return { error: 'Search service unavailable.' }
    }
  })
  .post('/api/search-events', async ({ body, set }) => {
    const typedBody = body as { query?: string }
    const q = String(typedBody?.query ?? '').trim()

    if (q.length >= 2) {
      // Record search signal (fire and forget)
      recordSearchQuery(q).catch(() => {})
    }

    return { status: 'accepted' }
  })
