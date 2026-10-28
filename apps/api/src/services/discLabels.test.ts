import { expect, test } from 'bun:test'

import { attachDiscLabels, findDiscLabel, type DiscLabelStore } from './discLabels'

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
    if (url.includes('missing')) return json({ releases: [] })
    return json({}, 500)
  }
  const album = (id: string, name: string) => ({ id, name, artists: ['Artist'] })

  const result = await attachDiscLabels([album('stored', 'Stored'), album('missing', 'Missing'), album('broken', 'Broken')], { maxLookups: 5, store, fetcher })

  expect(result.map((release) => release.discLabel)).toEqual([LABEL('stored'), undefined, undefined])
  expect(writes.map(({ albumId, label }) => ({ albumId, label }))).toEqual([{ albumId: 'missing', label: null }])
})
