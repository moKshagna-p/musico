import { expect, test } from 'bun:test'

import { matchBillboardAlbums } from './trending'

test('keeps only current Billboard matches when the chart is shorter than the requested limit', async () => {
  const result = await matchBillboardAlbums(
    [
      { rank: 1, artist: 'Daft Punk', name: 'Discovery' },
      { rank: 2, artist: 'Missing Artist', name: 'Missing Album' },
    ],
    async (query) => ({
      data: query.includes('Daft Punk')
        ? [{ id: 'm:1', name: 'Discovery', artists: ['Daft Punk'], popularity: 1, reviewCount: 0 }]
        : [],
    }),
    24,
  )

  expect(result.map((release) => release.id)).toEqual(['m:1'])
})

test('reads the latest snapshot in a single SQL statement scoped to its section', async () => {
  const script = `
    import { mock } from 'bun:test'
    import { drizzle } from 'drizzle-orm/pg-proxy'
    const queries = []
    const db = drizzle(async (sql, params) => {
      queries.push({ sql, params })
      return { rows: [] }
    })
    mock.module('./src/core/db.ts', () => ({ db }))
    const { getStoredTrendingAlbums } = await import('./src/services/trending.ts')
    const result = await getStoredTrendingAlbums(12, 'recent-popular')
    console.log(JSON.stringify({ result, queries }))
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname,
    stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  const { result, queries } = JSON.parse(stdout)
  expect(result).toEqual([])
  expect(queries).toHaveLength(1)
  expect(queries[0].sql).toContain('= (select max(')
  expect(queries[0].sql).toContain('order by "stored_trending_album"."rank" asc limit')
  expect(queries[0].params).toEqual(['recent-popular', 'recent-popular', 12])
})

const runRefreshScenario = async (scenario: string) => {
  const script = `
    import { mock } from 'bun:test'
    import { drizzle } from 'drizzle-orm/pg-proxy'
    const scenario = ${JSON.stringify(scenario)}
    const queries = []
    const db = drizzle(async (sql, params) => {
      queries.push({ sql, params })
      if (scenario === 'featured-db-failure' && sql.startsWith('insert') && params[0] === 'featured') {
        throw new Error('featured write failed')
      }
      return { rows: [] }
    })
    const candidates = [
      { id: 'r:1', name: 'First', artists: ['Artist'], popularity: 1, reviewCount: 0 },
      { id: 'r:2', name: 'Popular', artists: ['Artist'], popularity: 100, reviewCount: 0 },
    ]
    let fallbackCalls = 0
    let searchCalls = 0
    let detailCalls = 0
    mock.module('./src/core/db.ts', () => ({ db }))
    mock.module('./src/core/env.ts', () => ({ env: { HOMEPAGE_REFRESH_MINIMAL: false, HOME_RELEASE_DETAILS_PREWARM_LIMIT: 6 } }))
    mock.module('./src/services/charts.ts', () => ({ fetchBillboard200Albums: async () => {
      if (!['billboard-success', 'billboard-unmatched'].includes(scenario)) throw new Error('Billboard 200 request failed: 403')
      return [{ rank: 1, artist: 'Artist', name: 'First' }]
    } }))
    mock.module('./src/services/searchSignals.ts', () => ({ getTopSearchQueries: async () => ['stored-interest', 'cache-read-failure'].includes(scenario) ? [{ displayQuery: 'Artist', searchCount: 10 }] : [] }))
    mock.module('./src/services/discogs.ts', () => ({
      fetchRecentReleaseCandidatesFromDiscogs: async (_limit, options) => { if (options?.hydrate !== false) throw new Error('Refresh must not hydrate details'); fallbackCalls++; return scenario === 'empty' ? [] : [...candidates] },
      getStoredSearchResults: async (queries) => { if (scenario === 'cache-read-failure') throw new Error('cache read unavailable'); return new Map(queries.map((query) => [query, scenario === 'billboard-unmatched' ? [] : [{ ...candidates[0], releaseYear: new Date().getFullYear() }]])) },
      searchReleases: async () => { searchCalls++; return { data: [] } },
      getReleaseDetails: async () => { detailCalls++; return null },
    }))
    const { refreshStoredHomeAlbums } = await import('./src/services/trending.ts')
    let result, error
    try { result = await refreshStoredHomeAlbums({ happeningLimit: 24, recentLimit: 24 }) }
    catch (failure) { error = failure.message }
    console.log(JSON.stringify({ result, error, queries, fallbackCalls, searchCalls, detailCalls }))
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname,
    stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  expect(exitCode, stderr).toBe(0)
  return JSON.parse(stdout)
}

test('uses popularity-ranked Discogs albums when Billboard is blocked and refreshes both sections', async () => {
  const { result, queries, fallbackCalls } = await runRefreshScenario('billboard-blocked')
  expect(result.mostHappening.data.map((release) => release.id)).toEqual(['r:2', 'r:1'])
  expect(result.recentReleases.data).toHaveLength(2)
  expect(fallbackCalls).toBe(1)
  expect(queries.filter((query) => query.sql.startsWith('insert'))).toHaveLength(2)
})

test('keeps Billboard as the preferred featured source when it works', async () => {
  const { result, fallbackCalls } = await runRefreshScenario('billboard-success')
  expect(result.mostHappening.data.map((release) => release.id)).toEqual(['r:1'])
  expect(fallbackCalls).toBe(1) // Only the recent section needs Discogs candidates.
})

test('uses Discogs when a valid Billboard chart has no catalog matches', async () => {
  const { result, fallbackCalls } = await runRefreshScenario('billboard-unmatched')
  expect(result.mostHappening.data.map((release) => release.id)).toEqual(['r:2', 'r:1'])
  expect(fallbackCalls).toBe(1)
})

test('preserves existing snapshots when providers return no albums and reports both failures', async () => {
  const { error, queries, fallbackCalls } = await runRefreshScenario('empty')
  expect(error).toContain('featured: Homepage refresh returned no albums')
  expect(error).toContain('recent-popular: Homepage refresh returned no albums')
  expect(fallbackCalls).toBe(1)
  expect(queries.some((query) => /^(delete|insert)/.test(query.sql))).toBe(false)
})

test('attempts the recent section even when the featured database write fails', async () => {
  const { error, queries } = await runRefreshScenario('featured-db-failure')
  expect(error).toContain('featured:')
  expect(queries.filter((query) => query.sql.startsWith('insert')).map((query) => query.params[0]))
    .toEqual(['featured', 'recent-popular'])
})


test('homepage refresh retains cached search interest without interactive searches or detail prewarming', async () => {
  const { result, fallbackCalls, searchCalls, detailCalls } = await runRefreshScenario('stored-interest')
  expect(result.recentReleases.data.map((release) => release.id)).toEqual(['r:1', 'r:2'])
  expect(fallbackCalls).toBe(1)
  expect(searchCalls).toBe(0)
  expect(detailCalls).toBe(0)
})

test('uses shared candidates when the optional search cache read fails', async () => {
  const { result, error, queries, fallbackCalls, searchCalls } = await runRefreshScenario('cache-read-failure')
  expect(error).toBeUndefined()
  expect(result.recentReleases.data.map((release) => release.id)).toEqual(['r:1', 'r:2'])
  expect(queries.filter((query) => query.sql.startsWith('insert')).map((query) => query.params[0])).toEqual(['featured', 'recent-popular'])
  expect(fallbackCalls).toBe(1)
  expect(searchCalls).toBe(0)
})
