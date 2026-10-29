import { expect, test } from 'bun:test'

import { appleArtworkUrl, findArtistImage, findArtistLogo, normalizeName, pickEditorialArtwork } from './artistImages'
import { resetAudioDbRest } from './theAudioDb'

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
const APPLE_OG = 'https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages211/v4/5a/abc_cropped.png/1200x630cw.png'
// Apple Music's search page, listing the given artists by name and page URL.
const appleSearch = (artists: Array<[string, string]>) => new Response(`<script type="application/json" id="serialized-server-data">${JSON.stringify({
  data: [{ data: { sections: [{ items: artists.map(([title, url]) => ({ title, subtitle: 'Artist', contentDescriptor: { kind: 'artist', url } })) }] } }],
})}</script>`)

test('normalizes names without dropping non-Latin letters', () => {
  expect(normalizeName('Beyoncé!')).toBe('beyonce')
  expect(normalizeName('宇多田ヒカル')).toBe('宇多田ヒカル')
  expect(normalizeName('YOASOBI・ヨアソビ')).toBe('yoasobi ヨアソビ')
  expect(normalizeName('Сплин')).toBe('сплин')
})

test('upsizes Apple artist photos and rejects non-artist artwork', () => {
  expect(appleArtworkUrl(APPLE_OG)).toBe('https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages211/v4/5a/abc_cropped.png/1800x1800bb.webp')
  expect(appleArtworkUrl('https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/aa/cover.jpg/1200x630bb.jpg')).toBeNull()
  expect(appleArtworkUrl('https://evil.example.com/image/thumb/AMCArtistImages1/x.png/1200x630cw.png')).toBeNull()
})

test('uses the exact-name Apple match, then falls back to Deezer', async () => {
  const fetcher = async (url: string) => {
    if (url.includes('/search?') && url.includes('Tribute')) return appleSearch([['Tribute Band', 'https://music.apple.com/us/artist/x/2']])
    if (url.includes('/search?')) {
      return appleSearch([
        ['The Weeknd Tribute', 'https://music.apple.com/us/artist/tribute/1'],
        ['The Weeknd', 'https://music.apple.com/us/artist/the-weeknd/479756766'],
      ])
    }
    if (url === 'https://music.apple.com/us/artist/the-weeknd/479756766') {
      return new Response(`<meta property="og:image" content="${APPLE_OG}">`)
    }
    if (url.includes('api.deezer.com')) {
      return json({ data: [{ name: 'Tribute Band Name', picture_xl: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg' }] })
    }
    return new Response('not found', { status: 404 })
  }

  expect(await findArtistImage('The Weeknd', fetcher)).toEqual({
    image: appleArtworkUrl(APPLE_OG)!,
    source: 'apple',
    kind: 'portrait',
    video: null,
  })
  // Neither source has an exact-name match, so nothing is returned.
  expect(await findArtistImage('Tribute', fetcher)).toBeNull()
  expect(await findArtistImage('Tribute Band Name', async (url: string) => url.includes('deezer')
    ? json({ data: [{ name: 'Tribute Band Name', picture_xl: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg' }] })
    : appleSearch([]))).toEqual({ image: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg', source: 'deezer', kind: 'portrait', video: null })
})

const TEMPLATE = (path: string) => `https://is1-ssl.mzstatic.com/image/thumb/${path}/{w}x{h}{c}.{f}`

const VIDEO = 'https://mvod.itunes.apple.com/itunes-assets/HLSMusic221/v4/2d/P1_default.m3u8'

test('prefers motion heroes with their video, then editorial banners, keeping the aspect ratio', () => {
  const identity = { dictionary: { url: TEMPLATE('AMCArtistImages211/v4/a/photo.png'), width: 3000, height: 3000 } }
  const banner = { dictionary: { url: TEMPLATE('Features125/v4/b/banner.png'), width: 4320, height: 2160 } }
  const motion = { previewFrame: { url: TEMPLATE('Video211/v4/c/still.png'), width: 3840, height: 2160 }, video: VIDEO }
  const page = (items: object) => ({ data: [{ data: { sections: [{ items: [items] }] } }] })

  expect(pickEditorialArtwork(page({ wideArtwork: banner, wideVideoArtwork: { dictionary: { motionArtistFullscreen16x9: motion } } })))
    .toEqual({ image: 'https://is1-ssl.mzstatic.com/image/thumb/Video211/v4/c/still.png/2400x1350bb.webp', video: VIDEO })
  expect(pickEditorialArtwork(page({ wideArtwork: banner })))
    .toEqual({ image: 'https://is1-ssl.mzstatic.com/image/thumb/Features125/v4/b/banner.png/2400x1200bb.webp', video: null })
  // Videos must come from Apple's stream host.
  expect(pickEditorialArtwork(page({ wideVideoArtwork: { dictionary: { motionArtistFullscreen16x9: { ...motion, video: 'https://evil.example.com/x.m3u8' } } } }))?.video)
    .toBeNull()
  // A plain identity photo is not editorial; the og:image path handles it.
  expect(pickEditorialArtwork(page({ wideArtwork: identity }))).toBeNull()
  expect(pickEditorialArtwork(page({ wideArtwork: { dictionary: { url: 'https://evil.example.com/Features/{w}x{h}{c}.{f}', width: 10, height: 10 } } }))).toBeNull()
})

test('reads editorial art from the Apple page before falling back to og:image', async () => {
  const pageData = { data: [{ data: { sections: [{ items: [{ wideArtwork: { dictionary: { url: TEMPLATE('Features/v4/x/hero.png'), width: 4320, height: 2160 } } }] }] } }] }
  const fetcher = async (url: string) => {
    if (url.includes('/search?')) return appleSearch([['Editorial Artist', 'https://music.apple.com/us/artist/e/9']])
    return new Response(`<script type="application/json" id="serialized-server-data">${JSON.stringify(pageData)}</script><meta property="og:image" content="${APPLE_OG}">`)
  }
  expect(await findArtistImage('Editorial Artist', fetcher)).toEqual({
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Features/v4/x/hero.png/2400x1200bb.webp',
    source: 'apple',
    kind: 'editorial',
    video: null,
  })
})

test('uses a fanart.tv background before a square Apple photo when a key is set', async () => {
  const mbid = '4d8b7e5c-1f0a-4c5e-9a43-1b2c3d4e5f60'
  const fetcher = async (url: string) => {
    if (url.includes('/search?')) return appleSearch([['Small Band', 'https://music.apple.com/us/artist/s/3']])
    if (url.includes('music.apple.com')) return new Response(`<meta property="og:image" content="${APPLE_OG}">`)
    if (url.includes('musicbrainz.org')) return json({ artists: [{ id: 'other', name: 'Small Band Tribute' }, { id: mbid, name: 'Small Band' }] })
    if (url.includes(`fanart.tv/v3/music/${mbid}`)) {
      return json({ artistbackground: [
        { url: 'http://assets.fanart.tv/fanart/music/x/artistbackground/low.jpg', likes: '1' },
        { url: 'https://assets.fanart.tv/fanart/music/x/artistbackground/top.jpg', likes: '7' },
      ] })
    }
    return new Response('not found', { status: 404 })
  }

  expect(await findArtistImage('Small Band', fetcher, 'key')).toEqual({
    image: 'https://assets.fanart.tv/fanart/music/x/artistbackground/top.jpg',
    source: 'fanart',
    kind: 'editorial',
    video: null,
  })
  // Without a key, the square Apple photo is used.
  expect(await findArtistImage('Small Band Two', async (url: string) => fetcher(url.replace('Small%20Band%20Two', 'Small%20Band')).then(async (response) => {
    if (!url.includes('/search?')) return response
    return appleSearch([['Small Band Two', 'https://music.apple.com/us/artist/s/3']])
  }), undefined)).toEqual({ image: appleArtworkUrl(APPLE_OG)!, source: 'apple', kind: 'portrait', video: null })
})

test('finds artist logos on TheAudioDB, then fanart.tv HD logos', async () => {
  const MBID = '5b11f4ce-a62d-471e-81fc-a69a8278c7da'
  const fetcher = async (url: string) => {
    if (url.includes('theaudiodb.com') && url.includes('Nirvana')) {
      return json({ artists: [{ strArtist: 'Nirvana', strArtistLogo: 'https://r2.theaudiodb.com/images/media/artist/logo/nirvana.png' }] })
    }
    if (url.includes('theaudiodb.com')) return json({ artists: [{ strArtist: 'Low', strArtistLogo: null, strArtistMBID: MBID }] })
    if (url.includes(`fanart.tv/v3/music/${MBID}`)) {
      return json({
        musiclogo: [{ url: 'https://assets.fanart.tv/fanart/music/x/musiclogo/old.png', likes: '9' }],
        hdmusiclogo: [{ url: 'http://assets.fanart.tv/fanart/music/x/hdmusiclogo/hd.png', likes: '2' }],
      })
    }
    return new Response('not found', { status: 404 })
  }

  expect(await findArtistLogo('Nirvana', fetcher, { audioDb: '123', fanart: 'key' })).toBe('https://r2.theaudiodb.com/images/media/artist/logo/nirvana.png')
  expect(await findArtistLogo('Low', fetcher, { audioDb: '123', fanart: 'key' })).toBe('https://assets.fanart.tv/fanart/music/x/hdmusiclogo/hd.png')
  expect(await findArtistLogo('Nobody Here', async () => json({ artists: null }), { audioDb: '123' })).toBeNull()
})

test('falls back to fanart.tv while TheAudioDB is rate limited, without caching a miss', async () => {
  resetAudioDbRest()
  const MBID = '65f4f0c5-ef9e-490c-aee3-909e7ae6b2ab'
  const audioDbCalls: string[] = []
  const fetcher = (fanartLogo: boolean) => async (url: string) => {
    if (url.includes('theaudiodb.com')) {
      audioDbCalls.push(url)
      return new Response('slow down', { status: 429 })
    }
    if (url.includes('musicbrainz.org')) return json({ artists: [{ id: MBID, name: url.includes('Metallica') ? 'Metallica' : 'Ozzy Osbourne' }] })
    if (url.includes(`fanart.tv/v3/music/${MBID}`)) {
      return json(fanartLogo ? { hdmusiclogo: [{ url: 'https://assets.fanart.tv/fanart/music/x/hdmusiclogo/metallica.png', likes: '3' }] } : {})
    }
    return new Response('not found', { status: 404 })
  }

  expect(await findArtistLogo('Metallica', fetcher(true), { audioDb: '123', fanart: 'key' })).toBe('https://assets.fanart.tv/fanart/music/x/hdmusiclogo/metallica.png')
  // TheAudioDB rests for a minute after a 429, and a logo neither source could serve is not cached as missing.
  await expect(findArtistLogo('Ozzy Osbourne', fetcher(false), { audioDb: '123', fanart: 'key' })).rejects.toThrow('TheAudioDB unavailable')
  expect(audioDbCalls).toHaveLength(1)
  resetAudioDbRest()
})
