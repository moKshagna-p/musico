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
