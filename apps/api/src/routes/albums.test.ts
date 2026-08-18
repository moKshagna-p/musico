import { expect, test } from 'bun:test'

test('serves home from stored snapshots without synchronously refreshing providers', async () => {
  const source = await Bun.file(new URL('./albums.ts', import.meta.url)).text()

  expect(source).toContain('loadStoredFeaturedSection')
  expect(source).not.toContain('getStoredTrendingAlbumsEnsuringFresh')
})
