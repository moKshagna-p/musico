import { expect, test } from 'bun:test'

import { attachDiscLabels, findDiscLabel, type DiscLabelStore } from './discLabels'
import { resetAudioDbRest } from './theAudioDb'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const pressing = (id: string, { title = 'Rumours', artist = 'Fleetwood Mac', format = '12" Vinyl', type = 'Album', date = '1977' } = {}) => ({
  id,
  date,
  media: [{ format }],
  'artist-credit': [{ name: artist }],
  'release-group': { title, 'primary-type': type },
})
const photo = (types: string[], id: string) => ({
  types,
  image: `http://coverartarchive.org/release/x/${id}.jpg`,
  thumbnails: { 500: `http://coverartarchive.org/release/x/${id}-500.jpg` },
})
const LABEL = (id: string) => `https://coverartarchive.org/release/x/${id}-500.jpg`

test('picks the label photo from the oldest matching vinyl album pressing', async () => {
  const seen: string[] = []
  const fetcher = async (url: string) => {
    seen.push(url)
    if (url.includes('musicbrainz.org')) {
      return json({ releases: [
        pressing('cd', { format: 'CD', date: '1976' }),
        pressing('single', { type: 'Single', date: '1970' }),
        pressing('tribute', { artist: 'Fleetwood Mac Tribute', date: '1970' }),
        pressing('reissue', { date: '2011' }),
        pressing('original', { date: '1977-02-04' }),
      ] })
    }
    if (url.endsWith('/original')) return json({ images: [photo(['Front', 'Medium'], 'cover-and-disc'), photo(['Medium'], 'side-a')] })
    if (url.endsWith('/reissue')) return json({ images: [photo(['Medium'], 'reissue')] })
    return json({}, 404)
  }

  expect(await findDiscLabel('Fleetwood Mac', 'Rumours', fetcher)).toBe(LABEL('side-a'))
  // CDs and look-alike artists are skipped; a same-titled single only comes after every album pressing.
  expect(seen.filter((url) => url.includes('coverartarchive')).map((url) => url.split('/').pop())).toEqual(['original', 'reissue', 'single'])
})

test('ignores a leading "The" and edition notes when matching', async () => {
  const queries: string[] = []
  const fetcher = async (url: string) => {
    if (!url.includes('musicbrainz.org')) return json({ images: [photo(['Medium'], 'explorations')] })
    queries.push(new URL(url).searchParams.get('query') ?? '')
    return json({ releases: [pressing('a', { title: 'Explorations', artist: 'Bill Evans Trio' })] })
  }
  expect(await findDiscLabel('The Bill Evans Trio', 'Explorations [2025 Edition]', fetcher)).toBe(LABEL('explorations'))
  expect(queries).toEqual(['releasegroup:"explorations" AND artist:"bill evans trio"'])
})

test('keeps a found label when another pressing fails, and retries when none is found', async () => {
  const fetcher = (broken: string) => async (url: string) => {
    if (url.includes('musicbrainz.org')) return json({ releases: [pressing('a', { date: '1977' }), pressing('b', { date: '1978' })] })
    if (url.endsWith(`/${broken}`)) return json({}, 500)
    return json({ images: [photo(['Front'], 'front')] })
  }
  const withLabel = async (url: string) => (url.endsWith('/b') ? json({ images: [photo(['Medium'], 'b')] }) : fetcher('a')(url))
  expect(await findDiscLabel('Fleetwood Mac', 'Rumours', withLabel)).toBe(LABEL('b'))
  await expect(findDiscLabel('Fleetwood Mac', 'Rumours', fetcher('a'))).rejects.toThrow('returned 500')
})

test('returns null when no pressing has a disc-only photo', async () => {
  const fetcher = async (url: string) =>
    url.includes('musicbrainz.org') ? json({ releases: [pressing('a')] }) : json({ images: [photo(['Front'], 'front')] })
  expect(await findDiscLabel('Fleetwood Mac', 'Rumours', fetcher)).toBeNull()
})

test('reads stored labels, records misses, and skips failed lookups', async () => {
  const writes: Parameters<DiscLabelStore['write']>[0] = []
  const store: DiscLabelStore = {
    read: async () => [{ albumId: 'stored', label: LABEL('stored'), checkedAt: new Date() }],
    write: async (rows) => { writes.push(...rows) },
  }
  const fetcher = async (url: string) => {
    if (url.toLowerCase().includes('missing')) return json({ releases: [] })
    return json({}, 500)
  }
  const album = (id: string, name: string) => ({ id, name, artists: ['Artist'] })

  const result = await attachDiscLabels([album('stored', 'Stored'), album('missing', 'Missing'), album('broken', 'Broken')], { maxLookups: 5, store, fetcher })

  expect(result.map((release) => release.discLabel)).toEqual([LABEL('stored'), undefined, undefined])
  expect(writes.map(({ albumId, label }) => ({ albumId, label }))).toEqual([{ albumId: 'missing', label: null }])
})

test('falls back to TheAudioDB CD art, then fanart.tv by release group', async () => {
  const GROUP = '48117b90-a16e-34ca-a514-19c702df1158'
  const AUDIODB_ART = 'https://r2.theaudiodb.com/images/media/album/cdart/rumours.png'
  const FANART_ART = (id: string) => `https://assets.fanart.tv/fanart/music/x/cdart/${id}.png`
  const fetcher = (audioDbArt: string | null) => async (url: string) => {
    if (url.includes('musicbrainz.org')) return json({ releases: [{ ...pressing('cd', { format: 'CD' }), 'release-group': { id: GROUP, title: 'Rumours', 'primary-type': 'Album' } }] })
    if (url.includes('theaudiodb.com')) return json({ album: [{ strAlbum: 'Rumours', strArtist: 'Fleetwood Mac', strAlbumCDart: audioDbArt }] })
    if (url.includes(`fanart.tv/v3/music/albums/${GROUP}`)) {
      return json({ albums: { [GROUP]: { cdart: [{ url: FANART_ART('low'), likes: '1' }, { url: 'http://assets.fanart.tv/fanart/music/x/cdart/top.png', likes: '5' }] } } })
    }
    return json({}, 404)
  }
  const keys = { audioDb: '123', fanart: 'key' }

  expect(await findDiscLabel('Fleetwood Mac', 'Rumours', fetcher(AUDIODB_ART), keys)).toBe(AUDIODB_ART)
  expect(await findDiscLabel('Fleetwood Mac', 'Rumours', fetcher(''), keys)).toBe(FANART_ART('top'))
  // No fanart.tv key, no fanart.tv lookup; art from other hosts is never passed on.
  expect(await findDiscLabel('Fleetwood Mac', 'Rumours', fetcher(''), { audioDb: '123' })).toBeNull()
  expect(await findDiscLabel('Fleetwood Mac', 'Rumours', fetcher('https://evil.example.com/cdart/x.png'), { audioDb: '123' })).toBeNull()
})

test('uses fanart.tv while TheAudioDB is rate limited, and retries later when neither has art', async () => {
  resetAudioDbRest()
  const GROUP = '48117b90-a16e-34ca-a514-19c702df1158'
  const fetcher = (fanartArt: boolean) => async (url: string) => {
    if (url.includes('musicbrainz.org')) return json({ releases: [{ ...pressing('cd', { format: 'CD' }), 'release-group': { id: GROUP, title: 'Rumours', 'primary-type': 'Album' } }] })
    if (url.includes('theaudiodb.com')) return json({}, 429)
    if (url.includes('fanart.tv')) return json({ albums: { [GROUP]: { cdart: fanartArt ? [{ url: 'https://assets.fanart.tv/fanart/music/x/cdart/top.png', likes: '1' }] : [] } } })
    return json({}, 404)
  }
  const keys = { audioDb: '123', fanart: 'key' }

  expect(await findDiscLabel('Fleetwood Mac', 'Rumours', fetcher(true), keys)).toBe('https://assets.fanart.tv/fanart/music/x/cdart/top.png')
  const failure = await findDiscLabel('Fleetwood Mac', 'Rumours', fetcher(false), keys).catch((error) => error)
  // The first 429 started TheAudioDB's minute of rest, so this lookup never reached it.
  expect(failure.message).toBe('TheAudioDB is rate limited')
  // No status, so attachDiscLabels doesn't pause MusicBrainz lookups for TheAudioDB's limit.
  expect(failure.status).toBeUndefined()
  resetAudioDbRest()
})

test('fanart.tv failures retry the album without pausing MusicBrainz, and a failed pressing beats CD art', async () => {
  resetAudioDbRest()
  const GROUP = '48117b90-a16e-34ca-a514-19c702df1158'
  const fetcher = (caaStatus: number) => async (url: string) => {
    if (url.includes('musicbrainz.org')) return json({ releases: [{ ...pressing('v'), 'release-group': { id: GROUP, title: 'Rumours', 'primary-type': 'Album' } }] })
    if (url.includes('coverartarchive.org')) return json({}, caaStatus)
    if (url.includes('theaudiodb.com')) return json({ album: [{ strAlbum: 'Rumours', strArtist: 'Fleetwood Mac', strAlbumCDart: caaStatus === 404 ? null : 'https://r2.theaudiodb.com/images/media/album/cdart/rumours.png' }] })
    if (url.includes('fanart.tv')) return json({}, 429)
    return json({}, 404)
  }
  const keys = { audioDb: '123', fanart: 'key' }

  const failure = await findDiscLabel('Fleetwood Mac', 'Rumours', fetcher(404), keys).catch((error) => error)
  expect(failure.message).toBe('webservice.fanart.tv returned 429')
  expect(failure.status).toBeUndefined()
  // The vinyl photo might come back, so CD art isn't saved in its place while the archive is failing.
  await expect(findDiscLabel('Fleetwood Mac', 'Rumours', fetcher(500), keys)).rejects.toThrow('coverartarchive.org returned 500')
})
