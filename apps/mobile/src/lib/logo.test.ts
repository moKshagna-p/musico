import { expect, test } from 'bun:test'
import { decode, encode } from 'fast-png'

import { inkLogoPng } from './logo'

const fromDataUrl = (url: string) => decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)))

test('drops dark ink and repaints light ink in paper', () => {
  // Two opaque RGB pixels: one white letter, one black outline. Without inking, a tint would fill both.
  const png = encode({ width: 2, height: 1, data: new Uint8Array([255, 255, 255, 0, 0, 0]), channels: 3, depth: 8 })
  const out = fromDataUrl(inkLogoPng(png)!)
  expect(out.channels).toBe(4)
  expect(Array.from(out.data)).toEqual([238, 234, 227, 255, 238, 234, 227, 0])
})

test('keeps an all-dark logo as a paper silhouette', () => {
  const png = encode({ width: 1, height: 1, data: new Uint8Array([0, 255]), channels: 2, depth: 8 })
  expect(Array.from(fromDataUrl(inkLogoPng(png)!).data)).toEqual([238, 234, 227, 255])
})

test('returns null for files that are not PNGs', () => {
  expect(inkLogoPng(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull()
})
