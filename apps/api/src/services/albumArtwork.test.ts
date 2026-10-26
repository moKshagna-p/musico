import { expect, test } from 'bun:test'

import { attachHdCovers, cleanDiscogsArtist, findAppleAlbumCover, type ArtworkStore } from './albumArtwork'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const ART = (id: string) => `https://is1-ssl.mzstatic.com/image/thumb/Music/v4/${id}/cover.jpg/100x100bb.jpg`
const HD = (id: string) => `https://is1-ssl.mzstatic.com/image/thumb/Music/v4/${id}/cover.jpg/1200x1200bb.jpg`

test('cleans Discogs artist suffixes', () => {
  expect(cleanDiscogsArtist('Nirvana (2)')).toBe('Nirvana')
  expect(cleanDiscogsArtist('Prince*')).toBe('Prince')
})

test('matches Apple albums by artist and title, ignoring edition notes', async () => {
  const fetcher = async () => json({ results: [
    { artistName: 'Drake Tribute', collectionName: 'Take Care', artworkUrl100: ART('wrong') },
    { artistName: 'Drake', collectionName: 'Take Care (Deluxe Version)', artworkUrl100: ART('right') },
  ] })
  expect(await findAppleAlbumCover('Drake', 'Take Care', fetcher)).toBe(HD('right'))
  expect(await findAppleAlbumCover('Drake', 'Views', fetcher)).toBeNull()
  // Only Apple's own image host is accepted.
  expect(await findAppleAlbumCover('Drake', 'Take Care', async () => json({ results: [
    { artistName: 'Drake', collectionName: 'Take Care', artworkUrl100: 'https://evil.example.com/x/100x100bb.jpg' },
  ] }))).toBeNull()
})

const album = (id: string, name = `Album ${id}`) => ({ id, name, artists: ['Artist'], cover: `discogs-${id}` })

const memoryStore = (rows: Parameters<ArtworkStore['write']>[0] = []) => {
  const writes: typeof rows = []
  const store: ArtworkStore = {
    read: async (ids) => rows.filter((row) => ids.includes(row.albumId)),
    write: async (fresh) => { writes.push(...fresh) },
  }
  return { store, writes }
}

test('uses stored covers, caps new lookups, and records misses but not failures', async () => {
  const { store, writes } = memoryStore([{ albumId: 'a', cover: HD('a'), checkedAt: new Date() }])
  const fetcher = async (url: string) => {
    if (url.includes('Album%20b')) return json({ results: [{ artistName: 'Artist', collectionName: 'Album b', artworkUrl100: ART('b') }] })
    if (url.includes('Album%20c')) return json({ results: [] })
    return json({}, 500)
  }

  const result = await attachHdCovers([album('a'), album('b'), album('c'), album('d'), album('e')], { maxLookups: 3, store, fetcher })

  expect(result.map((release) => release.cover)).toEqual([HD('a'), HD('b'), 'discogs-c', 'discogs-d', 'discogs-e'])
  // b found, c confirmed missing, d failed (retried later), e over the lookup cap.
  expect(writes.map(({ albumId, cover }) => ({ albumId, cover }))).toEqual([
    { albumId: 'b', cover: HD('b') },
    { albumId: 'c', cover: null },
  ])
})

test('keeps Discogs covers when the artwork table cannot be read', async () => {
  const store: ArtworkStore = { read: async () => { throw new Error('relation "album_artwork" does not exist') }, write: async () => {} }
  const releases = [album('a')]
  expect(await attachHdCovers(releases, { store, fetcher: async () => json({}) })).toBe(releases)
})
