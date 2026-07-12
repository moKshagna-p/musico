import { Elysia } from 'elysia'
import { desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '../core/db'
import { user, userProfile } from '../core/schema'
import { searchReleases } from '../services/discogs'
import { recordSearchQuery } from '../services/searchSignals'
import { attachMusicoCommunityStats } from '../core/utils'
import { isRecord, MAX_SEARCH_QUERY_LENGTH, readBoundedText } from './validation'

export const searchRoutes = new Elysia()
  .get('/api/search', async ({ query, set }) => {
    const q = readBoundedText(query?.q, MAX_SEARCH_QUERY_LENGTH)
    const limit = Number(query?.limit ?? 12)
    const offset = Number(query?.offset ?? 0)
    if (q === null || !q) {
      set.status = 400
      return { error: 'Search query is required.' }
    }

    try {
      const { data, correctedQuery, hasMore, nextOffset, total } = await searchReleases(q, { limit, offset })
      const withStats = await attachMusicoCommunityStats(data)
      return { data: withStats, correctedQuery, hasMore, nextOffset, total }
    } catch (error) {
      set.status = 502
      return { error: 'Search service unavailable.' }
    }
  })
  .post('/api/search-events', async ({ body, set }) => {
    const typedBody = isRecord(body) ? body : null
    const q = readBoundedText(typedBody?.query, MAX_SEARCH_QUERY_LENGTH)

    if (q === null) {
      set.status = 400
      return { error: 'Search query must be valid text.' }
    }

    if (q.length >= 2) {
      // Record search signal (fire and forget)
      recordSearchQuery(q).catch(() => {})
    }

    return { status: 'accepted' }
  })
