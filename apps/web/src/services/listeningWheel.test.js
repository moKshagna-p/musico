import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeWheelAlbums, planWheelSpin } from './listeningWheel.js'

test('combining lists and individual albums normalizes IDs and removes duplicates', () => {
  const result = mergeWheelAlbums([{ id: 1, name: 'First' }, null], [{ id: '1' }, { id: ' 2 ' }])
  assert.deepEqual(result.map(album => album.id), ['1', '2'])
  assert.equal(result[0].name, 'First')
  assert.deepEqual(mergeWheelAlbums([]), [])
})

test('every album is eligible even when only eight covers are shown', () => {
  const albums = mergeWheelAlbums(Array.from({ length: 30 }, (_, i) => ({ id: i + 1 })))
  for (let index = 0; index < albums.length; index++) {
    const plan = planWheelSpin(albums, albums.slice(0, 8), 123, () => (index + 0.5) / albums.length)
    assert.equal(plan.winner.id, albums[index].id)
    assert.equal(plan.display.length, 8)
    const slot = plan.display.findIndex(album => album.id === plan.winner.id)
    assert.equal((plan.rotation + slot * 360 / plan.display.length) % 360, 0)
    assert.ok(plan.rotation >= 123 + 1800)
  }
})

test('empty and single-album wheels have valid results', () => {
  assert.equal(planWheelSpin([], [], 0), null)
  const albums = mergeWheelAlbums([{ id: 'one' }])
  const plan = planWheelSpin(albums, [], 0)
  assert.equal(plan.winner.id, 'one')
  assert.equal(plan.rotation % 360, 0)
  assert.equal(plan.display.length, 1)
})
