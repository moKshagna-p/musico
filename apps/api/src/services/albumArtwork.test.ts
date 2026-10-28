import { expect, test } from 'bun:test'

import { attachHdCovers, cleanDiscogsArtist, findAppleAlbumCover, type ArtworkStore } from './albumArtwork'
import { searchAppleMusic } from './artistImages'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const ART = (id: string) => `https://is1-ssl.mzstatic.com/image/thumb/Music/v4/${id}/cover.jpg/{w}x{h}bb.{f}`
// Apple Music's search page; Apple separates the kind and artist with narrow no-break spaces.
const appleSearch = (albums: Array<[artist: string, title: string, art: string]>) => new Response(`<script type="application/json" id="serialized-server-data">${JSON.stringify({
  data: [{ data: { sections: [{ items: albums.map(([artist, title, url]) => ({
    title,
    subtitle: `Album\u202f·\u202f${artist}`,
    artwork: { dictionary: { url, width: 3000, height: 3000 } },
    contentDescriptor: { kind: 'album', url: 'https://music.apple.com/us/album/x/1' },
  })) }] } }],
})}</script>`)
const HD = (id: string) => `https://is1-ssl.mzstatic.com/image/thumb/Music/v4/${id}/cover.jpg/600x600bb.jpg`

test('cleans Discogs artist suffixes', () => {
  expect(cleanDiscogsArtist('Nirvana (2)')).toBe('Nirvana')
  expect(cleanDiscogsArtist('Prince*')).toBe('Prince')
})

test('matches Apple albums by artist and title, ignoring edition notes', async () => {
  const fetcher = async () => appleSearch([
    ['Drake Tribute', 'Take Care', ART('wrong')],
    ['Drake', 'Take Care (Deluxe Version)', ART('right')],
  ])
  expect(await findAppleAlbumCover('Drake', 'Take Care', fetcher)).toBe(HD('right'))
  expect(await findAppleAlbumCover('Drake', 'Views', fetcher)).toBeNull()
  // Only Apple's own image host is accepted.
  expect(await findAppleAlbumCover('Drake', 'Take Care', async () => appleSearch([
    ['Drake', 'Take Care', 'https://evil.example.com/image/thumb/x/{w}x{h}bb.{f}'],
  ]))).toBeNull()
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
    if (url.includes('Album%20b')) return appleSearch([['Artist', 'Album b', ART('b')]])
    if (url.includes('Album%20c')) return appleSearch([])
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

test('serves covers stored at the old 1200px size at the current size', async () => {
  const { store } = memoryStore([{ albumId: 'a', cover: HD('a').replace('600x600bb', '1200x1200bb'), checkedAt: new Date() }])
  const [release] = await attachHdCovers([album('a')], { store, fetcher: async () => json({}) })
  expect(release.cover).toBe(HD('a'))
})

test('keeps Discogs covers when the artwork table cannot be read', async () => {
  const store: ArtworkStore = { read: async () => { throw new Error('relation "album_artwork" does not exist') }, write: async () => {} }
  const releases = [album('a')]
  expect(await attachHdCovers(releases, { store, fetcher: async () => json({}) })).toBe(releases)
})

test('reads artists and albums from a saved Apple Music search page', async () => {
  // Trimmed from a real music.apple.com/us/search response for "Taylor Swift The Life Of A Showgirl".
  const page = await Bun.file(new URL('./fixtures/apple-music-search.html', import.meta.url)).text()
  const fetcher = async () => new Response(page)

  const items = await searchAppleMusic('Taylor Swift The Life Of A Showgirl', fetcher)
  expect(items.find((item) => item.kind === 'artist')).toMatchObject({ title: 'Taylor Swift', url: 'https://music.apple.com/us/artist/taylor-swift/159260351' })
  // The album shows up both in top results (plain-text subtitle) and in the albums section (linked title and artist).
  const showgirl = { kind: 'album', title: 'The Life of a Showgirl', artist: 'Taylor Swift', url: 'https://music.apple.com/us/album/the-life-of-a-showgirl/1838810949' }
  expect(items.filter((item) => item.url === showgirl.url).map(({ artwork, ...item }) => item)).toEqual([showgirl, showgirl])
  expect(await findAppleAlbumCover('Taylor Swift', 'The Life Of A Showgirl', fetcher)).toBe(
    'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/58/8f/a9/588fa9a2-7cc5-f02c-9ce6-c986e0dc1c15/25UM1IM19577.rgb.jpg/600x600bb.jpg',
  )
  // Sabrina Carpenter only features on a song of that name, so it is not her album.
  expect(await findAppleAlbumCover('Sabrina Carpenter', 'The Life Of A Showgirl', fetcher)).toBeNull()
})
