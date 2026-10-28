import { expect, test } from 'bun:test'

process.env.BETTER_AUTH_URL ??= 'http://localhost:4000'
const { decodeInlineAvatar, isOwnAvatarUrl, toAvatarUrl } = await import('./avatar')

test('inline raster avatars become versioned links and decode back to bytes', () => {
  const image = `data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`
  const url = toAvatarUrl({ id: 'u1', image, updatedAt: new Date(1_700_000_000_000) })

  expect(url).toBe(`${process.env.BETTER_AUTH_URL}/api/avatars/u1?v=1700000000`)
  expect(isOwnAvatarUrl(url!, 'u1')).toBe(true)
  expect(isOwnAvatarUrl(url!, 'u2')).toBe(false)
  expect(decodeInlineAvatar(image)).toEqual({ type: 'image/png', bytes: Buffer.from('png-bytes') })
})

test('remote and svg avatars pass through untouched', () => {
  const updatedAt = new Date()
  expect(toAvatarUrl({ id: 'u1', image: 'https://cdn.example/a.jpg', updatedAt })).toBe('https://cdn.example/a.jpg')
  expect(toAvatarUrl({ id: 'u1', image: 'data:image/svg+xml;base64,PHN2Zy8+', updatedAt })).toBe('data:image/svg+xml;base64,PHN2Zy8+')
  expect(toAvatarUrl({ id: 'u1', image: null, updatedAt })).toBeNull()
  expect(decodeInlineAvatar('data:image/svg+xml;base64,PHN2Zy8+')).toBeNull()
})
