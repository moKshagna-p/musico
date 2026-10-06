import { expect, test } from 'bun:test'

test('serves home from stored snapshots without synchronously refreshing providers', async () => {
  const script = `
    import { mock } from 'bun:test'
    import { Elysia } from 'elysia'

    mock.module('./src/services/trending.ts', () => ({
      getStoredTrendingAlbumsEnsuringFresh: async () => { throw new Error('provider unavailable') },
      loadStoredFeaturedSection: async () => [],
    }))
    mock.module('./src/services/discogs.ts', () => ({ getReleaseDetails: async () => ({}) }))
    mock.module('./src/core/utils.ts', () => ({ attachMusicoCommunityStats: async (albums) => albums }))

    const { albumRoutes } = await import('./src/routes/albums.ts')
    const response = await new Elysia().use(albumRoutes).handle(new Request('http://localhost/api/home'))
    console.log(JSON.stringify(await response.json()))
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(JSON.parse(stdout)).toEqual({
    mostHappening: { data: [] },
    recentReleases: { data: [] },
  })
})

for (const failedMode of [null, 'featured', 'recent-popular']) {
  test(`hydrates home sections in one batch with ${failedMode ?? 'no'} section failure`, async () => {
    const script = `
      import { mock } from 'bun:test'
      import { Elysia } from 'elysia'
      const failedMode = ${JSON.stringify(failedMode)}
      const batches = []
      mock.module('./src/services/trending.ts', () => ({
        loadStoredFeaturedSection: async (mode) => {
          if (mode === failedMode) throw new Error('snapshot unavailable')
          return mode === 'featured' ? [{ id: 'shared' }, { id: 'featured' }] : [{ id: 'recent' }, { id: 'shared' }]
        },
      }))
      mock.module('./src/services/discogs.ts', () => ({ getReleaseDetails: async () => ({}) }))
      mock.module('./src/core/utils.ts', () => ({
        attachMusicoCommunityStats: async (albums) => {
          batches.push(albums.map(album => album.id))
          return albums.map(album => ({ ...album, communityRating: 4, reviewCount: 2 }))
        },
      }))
      const { albumRoutes } = await import('./src/routes/albums.ts')
      const response = await new Elysia().use(albumRoutes).handle(new Request('http://localhost/api/home'))
      console.log(JSON.stringify({ body: await response.json(), batches, cache: response.headers.get('cache-control'), status: response.status }))
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
    const result = JSON.parse(stdout)
    const happening = failedMode === 'featured' ? [] : ['shared', 'featured']
    const recent = failedMode === 'recent-popular' ? [] : ['recent', 'shared']
    expect(result.status).toBe(200)
    expect(result.batches).toEqual([[...happening, ...recent]])
    const hydrate = (ids: string[]) => ids.map(id => ({ id, communityRating: 4, reviewCount: 2 }))
    expect(result.body).toEqual({
      mostHappening: { data: hydrate(happening), ...(failedMode === 'featured' ? { error: 'Unable to load most happening albums.' } : {}) },
      recentReleases: { data: hydrate(recent), ...(failedMode === 'recent-popular' ? { error: 'Unable to load recent releases.' } : {}) },
    })
    expect(result.cache).toBe(failedMode ? 'no-store' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=21000')
  })
}

test('release responses never cache mutable community scores', async () => {
  const script = `
    import { mock } from 'bun:test'
    import { Elysia } from 'elysia'
    let score = 4
    mock.module('./src/services/trending.ts', () => ({ loadStoredFeaturedSection: async () => [] }))
    mock.module('./src/services/discogs.ts', () => ({ getReleaseDetails: async () => ({ id: 'm:1', name: 'Album' }) }))
    mock.module('./src/core/utils.ts', () => ({ attachMusicoCommunityStats: async (albums) => albums.map(album => ({ ...album, communityRating: score })) }))
    const { albumRoutes } = await import('./src/routes/albums.ts')
    const app = new Elysia().use(albumRoutes)
    const first = await app.handle(new Request('http://localhost/api/releases/m:1'))
    score = 4.5
    const second = await app.handle(new Request('http://localhost/api/releases/m:1'))
    console.log(JSON.stringify({ first: await first.json(), second: await second.json(), cache: second.headers.get('cache-control') }))
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname, stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(exitCode, stderr).toBe(0)
  const result = JSON.parse(stdout)
  expect(result.first.communityRating).toBe(4)
  expect(result.second.communityRating).toBe(4.5)
  expect(result.cache).toBe('no-store')
})
