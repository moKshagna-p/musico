import assert from 'node:assert/strict'
import test from 'node:test'

import { cleanArtistName } from './artistService.js'

test('strips Discogs disambiguation suffixes from artist names', () => {
  assert.equal(cleanArtistName('Drake (2)'), 'Drake')
  assert.equal(cleanArtistName('Prince*'), 'Prince')
  assert.equal(cleanArtistName('  Sade '), 'Sade')
})
