import assert from 'node:assert/strict'
import test from 'node:test'

import { coverAt, coverSrcSet, generateStreamingLinks } from './helpers.js'

test('Discogs albums offer a Spotify search when no direct Spotify URL exists', () => {
  const links = generateStreamingLinks({ name: 'Discovery', artists: ['Daft Punk'] })
  assert.equal(links.spotify, 'https://open.spotify.com/search/Daft%20Punk%20Discovery')
})

test('streaming links preserve a supplied Spotify album URL', () => {
  const spotify = 'https://open.spotify.com/album/example'
  assert.equal(generateStreamingLinks({ external_urls: { spotify } }).spotify, spotify)
  assert.deepEqual(generateStreamingLinks(null), {})
})

test('Apple covers are resized from the URL; other covers are left alone', () => {
  const apple = 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/30/a.rgb.jpg/1200x1200bb.jpg'
  assert.equal(coverAt(apple, 100), 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/30/a.rgb.jpg/100x100bb.webp')
  assert.match(coverSrcSet(apple), /\/300x300bb\.webp 300w, .+\/600x600bb\.webp 600w, .+\/1200x1200bb\.webp 1200w$/)
  const discogs = 'https://i.discogs.com/abc/rs:fit/g:sm/q:90/h:600/w:600/czM6.jpeg'
  assert.equal(coverAt(discogs, 100), discogs)
  assert.equal(coverSrcSet(discogs), undefined)
  assert.equal(coverAt(undefined, 100), undefined)
})
