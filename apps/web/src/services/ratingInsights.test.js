import test from 'node:test'
import assert from 'node:assert/strict'
import { listeningDiary, pickTopArtist, ratingSpread } from './ratingInsights.js'

test('ratings land in their half-star bucket and out-of-range values are ignored', () => {
  const counts = ratingSpread([{ rating: 0.5 }, { rating: 4 }, { rating: '4' }, { rating: 5 }, { rating: 0 }, { rating: 7 }])
  assert.equal(counts.length, 10)
  assert.equal(counts[0], 1)
  assert.equal(counts[7], 2)
  assert.equal(counts[9], 1)
  assert.equal(counts.reduce((a, b) => a + b, 0), 4)
})

test('the diary covers 53 Sunday-first weeks ending today and counts streaks', () => {
  const now = new Date(2026, 9, 29, 15) // a Thursday
  const at = (daysAgo) => new Date(2026, 9, 29 - daysAgo, 12).getTime()
  const diary = listeningDiary([{ timestamp: at(0) }, { timestamp: at(0) }, { timestamp: at(1) }, { timestamp: at(5) }, { timestamp: at(400) }], now)

  assert.equal(diary.weeks.length, 53)
  assert.ok(diary.weeks.slice(0, -1).every((week) => week.length === 7))
  assert.equal(diary.weeks[0][0].date.getDay(), 0)
  assert.equal(diary.weeks.at(-1).at(-1).date.getDate(), 29)
  assert.equal(diary.weeks.at(-1).at(-1).count, 2)
  assert.equal(diary.total, 4)
  assert.equal(diary.activeDays, 3)
  assert.equal(diary.longestStreak, 2)
})

test('the top artist is weighted by stars, skips misses, merges Discogs variants and breaks ties by recency', () => {
  const rated = (rating, timestamp, ...artists) => ({ rating, timestamp, artists })
  // Two loved albums beat three 3-star ones; 1-star ratings never count however many there are.
  assert.equal(pickTopArtist([
    rated(5, 10, 'Mac DeMarco'), rated(5, 9, 'Mac DeMarco*'),
    rated(3, 8, 'Radiohead'), rated(3, 7, 'Radiohead (2)'), rated(3, 6, 'radiohead'),
    rated(1, 5, 'Nickelback'), rated(1, 4, 'Nickelback'), rated(1, 3, 'Nickelback'), rated(1, 2, 'Nickelback'), rated(1, 1, 'Nickelback'),
  ]), 'Mac DeMarco')
  // Equal scores go to the artist rated most recently, whatever order the ratings arrive in.
  assert.equal(pickTopArtist([rated(4, 100, 'Older'), rated(4, 200, 'Newer')]), 'Newer')
  assert.equal(pickTopArtist([rated(4, 200, 'Newer'), rated(4, 100, 'Older')]), 'Newer')
  // Every credited artist on a collaboration gets the stars.
  assert.equal(pickTopArtist([rated(5, 2, 'Solo'), rated(4, 3, 'Duo A', 'Feature'), rated(4, 1, 'Feature')]), 'Feature')
  // The same artist credited twice, with different casing or a Discogs suffix, only gets the album's stars once.
  assert.equal(pickTopArtist([rated(5, 1, 'Solo'), rated(3, 2, 'Feature', 'feature (2)')]), 'Solo')
  assert.equal(pickTopArtist([rated(2, 1, 'Meh')]), null)
  assert.equal(pickTopArtist([]), null)
})
