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
