// Artist logos are drawn for any background, so they are repainted in the page's paper white to read on our dark heroes.
// Their dark parts (black outlines, 3D extrusions like Metallica's, drop shadows like Nirvana's) were drawn for a light
// background, so they are dropped and the light ink stays. A logo that is almost all dark ink becomes a paper silhouette.
const PAPER = [238, 234, 227]
// A pixel whose brightest channel is at or below DARK is dark ink; ink fades out over the next FADE so edges stay smooth.
const DARK = 0.2
const FADE = 0.2

const brightness = (pixels, i) => Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) / 255

// Takes RGBA pixels (ImageData.data) and repaints them in place.
export const inkLogo = (pixels) => {
  let opaque = 0
  let dark = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    opaque += 1
    if (brightness(pixels, i) <= DARK) dark += 1
  }
  const hasLightInk = dark < opaque * 0.9
  for (let i = 0; i < pixels.length; i += 4) {
    const keep = hasLightInk ? Math.min(1, Math.max(0, (brightness(pixels, i) - DARK) / FADE)) : 1
    pixels[i] = PAPER[0]
    pixels[i + 1] = PAPER[1]
    pixels[i + 2] = PAPER[2]
    pixels[i + 3] = Math.round(pixels[i + 3] * keep)
  }
  return pixels
}
