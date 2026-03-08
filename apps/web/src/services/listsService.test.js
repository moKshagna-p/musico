import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeListName, toListAlbumSummary } from './listsService.js'

test('normalizeListName trims, collapses whitespace, and enforces max length', () => {
  const normalized = normalizeListName('   My    Favorite    Albums   ')
  assert.equal(normalized, 'My Favorite Albums')

  const longName = normalizeListName('x'.repeat(80))
  assert.equal(longName.length, 48)
})

test('toListAlbumSummary returns null when album id is missing', () => {
  assert.equal(toListAlbumSummary({ name: 'No ID' }), null)
})

test('toListAlbumSummary returns safe normalized album fields', () => {
  const result = toListAlbumSummary({
    id: ' 123 ',
    name: '  Album Name  ',
    cover: 'https://image.test/cover.jpg',
    artists: ['A', null, 'B', 'C', 'D'],
    releaseYear: 1999,
    addedAt: 1700000000000,
  })

  assert.deepEqual(result, {
    id: '123',
    name: 'Album Name',
    cover: 'https://image.test/cover.jpg',
    artists: ['A', 'B', 'C'],
    releaseYear: 1999,
    addedAt: 1700000000000,
  })
})
