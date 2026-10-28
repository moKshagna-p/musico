import { expect, test } from 'bun:test'

process.env.BETTER_AUTH_URL ??= 'http://localhost:4000'
const { avatarPath, isOwnAvatarUrl, parseInlineAvatar, toAvatarUrl } = await import('./avatar')

test('inline raster avatars become versioned links and split into type and base64', () => {
  const data = Buffer.from('png-bytes').toString('base64')
  const url = toAvatarUrl({ id: 'u1', image: `data:image/png;base64,${data}`, updatedAt: new Date(1_700_000_000_000) })

  expect(url).toBe(`${process.env.BETTER_AUTH_URL}/api/avatars/u1?v=1700000000`)
  expect(isOwnAvatarUrl(url!, 'u1')).toBe(true)
  expect(isOwnAvatarUrl(url!, 'u2')).toBe(false)
  expect(parseInlineAvatar(`data:image/png;base64,${data}`)).toEqual({ contentType: 'image/png', data })
})

test('stored relative avatar paths become absolute links', () => {
  const image = avatarPath('u1', new Date(1_700_000_000_000))
  expect(image).toBe('/api/avatars/u1?v=1700000000')
  const url = toAvatarUrl({ id: 'u1', image, updatedAt: new Date() })
  expect(url).toBe(`${process.env.BETTER_AUTH_URL}/api/avatars/u1?v=1700000000`)
  expect(isOwnAvatarUrl(url!, 'u1')).toBe(true)
})

test('remote and svg avatars pass through untouched', () => {
  const updatedAt = new Date()
  expect(toAvatarUrl({ id: 'u1', image: 'https://cdn.example/a.jpg', updatedAt })).toBe('https://cdn.example/a.jpg')
  expect(toAvatarUrl({ id: 'u1', image: 'data:image/svg+xml;base64,PHN2Zy8+', updatedAt })).toBe('data:image/svg+xml;base64,PHN2Zy8+')
  expect(toAvatarUrl({ id: 'u1', image: null, updatedAt })).toBeNull()
  expect(parseInlineAvatar('data:image/svg+xml;base64,PHN2Zy8+')).toBeNull()
})
