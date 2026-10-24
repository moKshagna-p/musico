import { expect, test } from 'bun:test'

import { appleArtworkUrl, findArtistImage, pickEditorialArtwork } from './artistImages'

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
const APPLE_OG = 'https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages211/v4/5a/abc_cropped.png/1200x630cw.png'

test('upsizes Apple artist photos and rejects non-artist artwork', () => {
  expect(appleArtworkUrl(APPLE_OG)).toBe('https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages211/v4/5a/abc_cropped.png/1800x1800bb.webp')
  expect(appleArtworkUrl('https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/aa/cover.jpg/1200x630bb.jpg')).toBeNull()
  expect(appleArtworkUrl('https://evil.example.com/image/thumb/AMCArtistImages1/x.png/1200x630cw.png')).toBeNull()
})

test('uses the exact-name Apple match, then falls back to Deezer', async () => {
  const fetcher = async (url: string) => {
    if (url.includes('itunes.apple.com') && url.includes('Tribute')) {
      return json({ results: [{ artistName: 'Tribute Band', artistLinkUrl: 'https://music.apple.com/us/artist/x/2' }] })
    }
    if (url.includes('itunes.apple.com')) {
      return json({ results: [
        { artistName: 'The Weeknd Tribute', artistLinkUrl: 'https://music.apple.com/us/artist/tribute/1' },
        { artistName: 'The Weeknd', artistLinkUrl: 'https://music.apple.com/us/artist/the-weeknd/479756766?uo=4' },
      ] })
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
  })
  // Neither source has an exact-name match, so nothing is returned.
  expect(await findArtistImage('Tribute', fetcher)).toBeNull()
  expect(await findArtistImage('Tribute Band Name', async (url: string) => url.includes('deezer')
    ? json({ data: [{ name: 'Tribute Band Name', picture_xl: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg' }] })
    : json({ results: [] }))).toEqual({ image: 'https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg', source: 'deezer', kind: 'portrait' })
})

const TEMPLATE = (path: string) => `https://is1-ssl.mzstatic.com/image/thumb/${path}/{w}x{h}{c}.{f}`

test('prefers editorial banners, then motion stills, and keeps their aspect ratio', () => {
  const identity = { dictionary: { url: TEMPLATE('AMCArtistImages211/v4/a/photo.png'), width: 3000, height: 3000 } }
  const banner = { dictionary: { url: TEMPLATE('Features125/v4/b/banner.png'), width: 4320, height: 2160 } }
  const motion = { previewFrame: { url: TEMPLATE('Video211/v4/c/still.png'), width: 3840, height: 2160 } }
  const page = (items: object) => ({ data: [{ data: { sections: [{ items: [items] }] } }] })

  expect(pickEditorialArtwork(page({ wideArtwork: banner, wideVideoArtwork: { dictionary: { motionArtistFullscreen16x9: motion } } })))
    .toBe('https://is1-ssl.mzstatic.com/image/thumb/Features125/v4/b/banner.png/2400x1200bb.webp')
  expect(pickEditorialArtwork(page({ wideArtwork: identity, wideVideoArtwork: { dictionary: { motionArtistFullscreen16x9: motion } } })))
    .toBe('https://is1-ssl.mzstatic.com/image/thumb/Video211/v4/c/still.png/2400x1350bb.webp')
  // A plain identity photo is not editorial; the og:image path handles it.
  expect(pickEditorialArtwork(page({ wideArtwork: identity }))).toBeNull()
  expect(pickEditorialArtwork(page({ wideArtwork: { dictionary: { url: 'https://evil.example.com/Features/{w}x{h}{c}.{f}', width: 10, height: 10 } } }))).toBeNull()
})

test('reads editorial art from the Apple page before falling back to og:image', async () => {
  const pageData = { data: [{ data: { sections: [{ items: [{ wideArtwork: { dictionary: { url: TEMPLATE('Features/v4/x/hero.png'), width: 4320, height: 2160 } } }] }] } }] }
  const fetcher = async (url: string) => {
    if (url.includes('itunes.apple.com')) return json({ results: [{ artistName: 'Editorial Artist', artistLinkUrl: 'https://music.apple.com/us/artist/e/9' }] })
    return new Response(`<script type="application/json" id="serialized-server-data">${JSON.stringify(pageData)}</script><meta property="og:image" content="${APPLE_OG}">`)
  }
  expect(await findArtistImage('Editorial Artist', fetcher)).toEqual({
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Features/v4/x/hero.png/2400x1200bb.webp',
    source: 'apple',
    kind: 'editorial',
  })
})
