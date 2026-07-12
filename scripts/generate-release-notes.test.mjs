import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReleaseNotes } from './generate-release-notes.mjs'

test('creates a concise, category-based release summary', () => {
  const notes = buildReleaseNotes({
    base: 'v0.0.7',
    commits: [
      { hash: 'a1', subject: 'feat: add curated discovery playlists' },
      { hash: 'b2', subject: 'fix(api): stabilize album cache refreshes' },
      { hash: 'c3', subject: 'feat: add collaborative listening rooms' },
      { hash: 'd4', subject: 'chore: update release documentation' },
      { hash: 'e5', subject: 'fix(auth): harden session validation' },
    ],
  })

  const contentLines = notes.trim().split('\n').filter(Boolean)

  assert.ok(contentLines.length >= 4 && contentLines.length <= 5)
  assert.match(notes, /5 commits since v0\.0\.7/)
  assert.match(notes, /Security: harden session validation/i)
  assert.match(notes, /Features: add curated discovery playlists; add collaborative listening rooms/i)
  assert.match(notes, /Reliability: stabilize album cache refreshes/i)
  assert.match(notes, /Maintenance: update release documentation/i)
})

test('reports an empty release range without failing', () => {
  const notes = buildReleaseNotes({ base: 'v0.0.7', commits: [] })

  assert.match(notes, /0 commits since v0\.0\.7/)
  assert.match(notes, /No code changes were detected/)
})
