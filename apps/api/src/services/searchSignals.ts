import { desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '../core/db'
import { userSearchTrend } from '../core/schema'

const SEARCH_WINDOW_DAYS = 45
const MAX_TOP_SEARCH_QUERIES = 18

const normalizeQuery = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

export const recordSearchQuery = async (query: string) => {
  const displayQuery = String(query ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
  const normalizedQuery = normalizeQuery(displayQuery)
  if (!normalizedQuery) return

  const now = new Date()

  await db
    .insert(userSearchTrend)
    .values({
      normalizedQuery,
      displayQuery,
      searchCount: 1,
      createdAt: now,
      updatedAt: now,
      lastSearchedAt: now,
    })
    .onConflictDoUpdate({
      target: userSearchTrend.normalizedQuery,
      set: {
        displayQuery,
        searchCount: sql`${userSearchTrend.searchCount} + 1`,
        updatedAt: now,
        lastSearchedAt: now,
      },
    })
}

export const getTopSearchQueries = async (limit = MAX_TOP_SEARCH_QUERIES) => {
  const since = new Date(Date.now() - SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const rows = await db
    .select({
      normalizedQuery: userSearchTrend.normalizedQuery,
      displayQuery: userSearchTrend.displayQuery,
      searchCount: userSearchTrend.searchCount,
      lastSearchedAt: userSearchTrend.lastSearchedAt,
    })
    .from(userSearchTrend)
    .where(gte(userSearchTrend.lastSearchedAt, since))
    .orderBy(desc(userSearchTrend.searchCount), desc(userSearchTrend.lastSearchedAt))
    .limit(Math.max(1, limit))

  return rows
}

export const getSearchQueryCount = async (normalizedQuery: string) => {
  const rows = await db
    .select({ searchCount: userSearchTrend.searchCount })
    .from(userSearchTrend)
    .where(eq(userSearchTrend.normalizedQuery, normalizedQuery))
    .limit(1)

  return rows[0]?.searchCount ?? 0
}
