import test from 'node:test'
import assert from 'node:assert/strict'
import { listeningDiary, ratingSpread } from './ratingInsights.js'

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
