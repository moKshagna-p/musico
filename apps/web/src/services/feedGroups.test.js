import test from 'node:test'
import assert from 'node:assert/strict'
import { dayLabel, feedDays, groupFeed } from './feedGroups.js'

const now = new Date(2026, 9, 29, 18).getTime()
const minutes = (n) => now - n * 60_000
const item = (id, userId, type, extra = {}) => ({ id, userId, type, user: { username: userId }, createdAt: minutes(0), ...extra })

test('a burst by one person collapses into one group with one entry per album', () => {
  const groups = groupFeed([
    item('1', 'jonas', 'listed', { albumId: 'tod', createdAt: minutes(6), metadata: { listId: 'l1', listName: 'comfort' } }),
    item('2', 'jonas', 'rated', { albumId: 'tod', createdAt: minutes(6), metadata: { rating: 3.5 } }),
    item('3', 'jonas', 'listed', { albumId: 'tf', createdAt: minutes(7), metadata: { listId: 'l1', listName: 'comfort' } }),
    item('4', 'jonas', 'rated', { albumId: 'tf', createdAt: minutes(8), metadata: { rating: 3.5 } }),
    item('5', 'jonas', 'rated', { albumId: 'tf', createdAt: minutes(9), metadata: { rating: 2 } }),
    item('6', 'jonas', 'followed', { createdAt: minutes(10), targetUser: { username: 'mo' } }),
    item('7', 'mo', 'reviewed', { albumId: 'dbd', createdAt: minutes(15), metadata: { snippet: 'Loud.' } }),
  ])

  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].albums.map((album) => [album.albumId, album.rating, album.lists.length]), [['tod', 3.5, 1], ['tf', 3.5, 1]])
  assert.deepEqual(groups[0].follows, [{ username: 'mo' }])
  assert.equal(groups[1].albums[0].reviewed, true)
  assert.equal(groups[1].albums[0].snippet, 'Loud.')
})

test('a long pause or another person in between starts a new group', () => {
  const groups = groupFeed([
    item('1', 'jonas', 'rated', { albumId: 'a', createdAt: minutes(0), metadata: { rating: 4 } }),
    item('2', 'jonas', 'rated', { albumId: 'b', createdAt: minutes(90), metadata: { rating: 4 } }),
    item('3', 'mo', 'rated', { albumId: 'c', createdAt: minutes(95), metadata: { rating: 4 } }),
    item('4', 'jonas', 'rated', { albumId: 'd', createdAt: minutes(96), metadata: { rating: 4 } }),
  ])
  assert.deepEqual(groups.map((group) => group.albums[0].albumId), ['a', 'b', 'c', 'd'])
})

test('groups split at midnight and land under day headings', () => {
  const lateLastNight = new Date(2026, 9, 28, 23, 50).getTime()
  const justAfterMidnight = new Date(2026, 9, 29, 0, 10).getTime()
  const groups = groupFeed([
    item('1', 'jonas', 'rated', { albumId: 'a', createdAt: justAfterMidnight, metadata: { rating: 4 } }),
    item('2', 'jonas', 'rated', { albumId: 'b', createdAt: lateLastNight, metadata: { rating: 4 } }),
  ])
  assert.deepEqual(feedDays(groups, now).map((day) => [day.label, day.groups.length]), [['Today', 1], ['Yesterday', 1]])
  assert.equal(dayLabel(new Date(2026, 9, 26).getTime(), now), 'Monday')
  assert.equal(dayLabel(new Date(2026, 8, 3).getTime(), now), 'September 3')
  assert.equal(dayLabel(new Date(2025, 8, 3).getTime(), now), 'September 3, 2025')
})
