import { expect, test } from 'bun:test'

import { isKlipyUrl, mediaKey, parseMediaKey, sniffImage } from './media'
import { readReviewMedia } from '../routes/reviews'
import { searchGifs, toGif } from '../services/klipy'

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)])
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

test('sniffImage trusts magic bytes, not names', () => {
  expect(sniffImage(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')))).toBe('webp')
  expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg')
  expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png')
  expect(sniffImage(bytes(...ascii('GIF89a')))).toBe('gif')
  expect(sniffImage(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')))).toBeNull()
  expect(sniffImage(bytes(...ascii('<svg')))).toBeNull()
})

test('media keys round-trip and reject paths that escape the reviews prefix', () => {
  const key = mediaKey('user_1', '0b6f3c2e-8a59-4c47-9d2e-1f2a3b4c5d6e', 'webp')
  expect(parseMediaKey(key)).toEqual({ contentType: 'image/webp' })
  expect(parseMediaKey('reviews/user_1/../secret.webp')).toBeNull()
  expect(parseMediaKey('reviews/user_1/0b6f3c2e-8a59-4c47-9d2e-1f2a3b4c5d6e.svg')).toBeNull()
  expect(parseMediaKey('avatars/user_1/0b6f3c2e-8a59-4c47-9d2e-1f2a3b4c5d6e.webp')).toBeNull()
})

test('isKlipyUrl only allows https on klipy.com hosts', () => {
  expect(isKlipyUrl('https://static.klipy.com/ii/abc/def.webp')).toBe(true)
  expect(isKlipyUrl('https://klipy.com/gifs/x')).toBe(true)
  expect(isKlipyUrl('http://static.klipy.com/a.gif')).toBe(false)
  expect(isKlipyUrl('https://klipy.com.evil.test/a.gif')).toBe(false)
  expect(isKlipyUrl('https://evilklipy.com/a.gif')).toBe(false)
  expect(isKlipyUrl('javascript:alert(1)')).toBe(false)
})

test('readReviewMedia allows up to four images or one GIF, never both', () => {
  const gif = { url: 'https://static.klipy.com/a.webp', width: 320, height: 240 }
  expect(readReviewMedia({})).toEqual({ images: [], gif: null })
  expect(readReviewMedia({ media: [{ id: 'a', alt: 'cover' }, { id: 'b' }] })).toEqual({
    images: [{ id: 'a', alt: 'cover' }, { id: 'b', alt: '' }],
    gif: null,
  })
  expect(readReviewMedia({ gif })).toEqual({ images: [], gif: { ...gif, alt: '' } })
  expect(readReviewMedia({ media: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })) })).toBeNull()
  expect(readReviewMedia({ media: [{ id: 'a' }, { id: 'a' }] })).toBeNull()
  expect(readReviewMedia({ media: [{ id: 'a' }], gif })).toBeNull()
  expect(readReviewMedia({ gif: { ...gif, url: 'https://example.com/a.gif' } })).toBeNull()
  expect(readReviewMedia({ gif: { ...gif, width: 0 } })).toBeNull()
})

const klipyItem = {
  id: 42,
  title: 'spinning record',
  file: {
    hd: { gif: { url: 'https://static.klipy.com/hd.gif', width: 640, height: 480 } },
    md: { webp: { url: 'https://static.klipy.com/md.webp', width: 320, height: 240 }, gif: { url: 'https://static.klipy.com/md.gif', width: 320, height: 240 } },
    sm: { gif: { url: 'https://static.klipy.com/sm.gif', width: 160, height: 120 } },
  },
}

test('toGif prefers WebP and drops items without files (ads)', () => {
  expect(toGif(klipyItem)).toEqual({
    id: '42',
    title: 'spinning record',
    url: 'https://static.klipy.com/md.webp',
    preview: 'https://static.klipy.com/sm.gif',
    width: 320,
    height: 240,
  })
  expect(toGif({ id: 7, title: 'ad' })).toBeNull()
})

test('searchGifs hits trending without a query, search with one, and caches', async () => {
  process.env.KLIPY_API_KEY = 'test-key'
  const calls: string[] = []
  const fetcher = async (url: string) => {
    calls.push(url)
    return Response.json({ result: true, data: { data: [klipyItem, { id: 1 }] } })
  }
  expect(await searchGifs('', 1, fetcher)).toHaveLength(1)
  expect(await searchGifs('vinyl', 2, fetcher)).toHaveLength(1)
  await searchGifs('Vinyl', 2, fetcher)
  expect(calls).toHaveLength(2)
  expect(calls[0]).toStartWith('https://api.klipy.com/api/v1/test-key/gifs/trending?')
  expect(calls[1]).toContain('/gifs/search?')
  expect(new URL(calls[1]!).searchParams.get('q')).toBe('vinyl')
  expect(new URL(calls[1]!).searchParams.get('page')).toBe('2')
})
