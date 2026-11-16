import { decode, encode } from 'fast-png'

import { inkLogo } from '../../../web/src/utils/logoInk.js'

// fast-png hands back whatever the file stored (gray, gray+alpha, RGB, RGBA or a palette, 8 or 16 bit); inkLogo wants 8-bit RGBA.
const toRgba = ({ width, height, data, channels, depth, palette }: ReturnType<typeof decode>) => {
  const out = new Uint8ClampedArray(width * height * 4)
  const shift = depth === 16 ? 8 : 0
  for (let p = 0; p < width * height; p += 1) {
    const at = p * channels
    const o = p * 4
    if (palette) {
      const [r, g, b, a = 255] = palette[data[at]] ?? [0, 0, 0, 0]
      out.set([r, g, b, a], o)
    } else if (channels < 3) {
      const v = data[at] >> shift
      out.set([v, v, v, channels === 2 ? data[at + 1] >> shift : 255], o)
    } else {
      out.set([data[at] >> shift, data[at + 1] >> shift, data[at + 2] >> shift, channels === 4 ? data[at + 3] >> shift : 255], o)
    }
  }
  return out
}

// The web repaints logos on a canvas (components/ui/ArtistName.jsx); the app does the same to the PNG's pixels, so
// logos drawn for light backgrounds lose their dark ink instead of tinting into a solid block. Returns a PNG data URL,
// or null for files that aren't PNGs (the name shows instead).
export const inkLogoPng = (bytes: Uint8Array) => {
  let png
  try {
    png = decode(bytes)
  } catch {
    return null
  }
  const rgba = toRgba(png)
  inkLogo(rgba)
  const out = encode({ width: png.width, height: png.height, data: new Uint8Array(rgba.buffer), channels: 4, depth: 8 })
  let binary = ''
  for (let i = 0; i < out.length; i += 0x8000) binary += String.fromCharCode(...out.subarray(i, i + 0x8000))
  return `data:image/png;base64,${btoa(binary)}`
}
