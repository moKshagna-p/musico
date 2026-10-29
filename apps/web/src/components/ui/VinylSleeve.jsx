import { useState } from 'react'

import { CD_ART_CLASS, isCdArt } from '../../utils/discArt.js'
import CoverImage from './CoverImage.jsx'

// A record sleeve with its disc behind it. `out` pulls the disc halfway out (sliding it out on mount, after a cover
// morph has landed);
// otherwise it slides out (right, or `up` like pulling from a crate) on hover of the nearest `.group`.
// `label` is a photo of the record's real center label, or a fan-made CD face; without one the disc shows the cover art.
// Label photos show a ring of the actual vinyl in their corners, so colored records get colored grooves.
const HOVER_PULL = {
  right: 'group-hover:translate-x-[16%] group-focus-visible:translate-x-[16%]',
  up: 'group-hover:-translate-y-[18%] group-focus-visible:-translate-y-[18%]',
}

// Averages the pixels outside the label circle. Grays are skipped: that is black vinyl or a scanner background.
// ponytail: plain average, so a busy splatter reads as its mean color; sample clusters if that looks muddy.
const readVinylColor = (image) => {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, size, size)
  const { data } = context.getImageData(0, 0, size, size)
  const total = [0, 0, 0]
  let count = 0
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) < size * 0.52) continue
      const offset = (y * size + x) * 4
      total[0] += data[offset]
      total[1] += data[offset + 1]
      total[2] += data[offset + 2]
      count += 1
    }
  }
  const [r, g, b] = total.map((sum) => Math.round(sum / count))
  return Math.max(r, g, b) - Math.min(r, g, b) < 40 ? null : `rgb(${r} ${g} ${b})`
}

const VinylSleeve = ({ src, label, alt = '', out = false, pull = 'right', spin = false, size = 640, loading = 'lazy', sizes, className = '', ...props }) => {
  const [vinylColor, setVinylColor] = useState(null)
  return (
    <div className={`relative aspect-square ${className}`} {...props}>
      <div
        aria-hidden="true"
        style={vinylColor ? { '--vinyl': vinylColor } : undefined}
        className={`vinyl absolute inset-[4%] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          out ? 'translate-x-[40%] motion-safe:animate-[vinylPullOut_1.1s_cubic-bezier(0.16,1,0.3,1)_0.5s_both]' : HOVER_PULL[pull]
        }`}
      >
        <div className={`absolute inset-[33%] overflow-hidden rounded-full ring-1 ring-black ${spin ? 'motion-safe:animate-[vinylSpin_9s_linear_infinite]' : ''}`}>
          {label || src ? (
            <img
              src={label || src}
              alt=""
              loading={loading}
              decoding="async"
              // archive.org allows cross-origin reads, which lets the canvas sample the label photo.
              crossOrigin={label && !isCdArt(label) ? 'anonymous' : undefined}
              onLoad={(event) => { if (label && !isCdArt(label) && event.currentTarget.src === label) setVinylColor(readVinylColor(event.currentTarget)) }}
              // The Cover Art Archive is served from archive.org; fall back to the cover if it is unreachable.
              onError={(event) => {
                if (!src || event.currentTarget.src === src) return
                event.currentTarget.removeAttribute('crossorigin')
                event.currentTarget.src = src
              }}
              className={`h-full w-full object-cover ${isCdArt(label) ? CD_ART_CLASS : ''}`}
            />
          ) : <div className="h-full w-full bg-paper/80" />}
          <span className="absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
        </div>
      </div>
      {/* Only the sleeve flies in cover morphs (utils/morph.js); the disc stays put and fades with the page. */}
      <div data-sleeve="" className="relative h-full w-full overflow-hidden rounded-[4px] bg-panel shadow-sleeve">
        <CoverImage
          src={src}
          alt={alt}
          width={size}
          height={size}
          sizes={sizes}
          loading={loading}
          className="block aspect-square h-full w-full object-cover"
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[4px] ring-1 ring-inset ring-white/10" />
      </div>
    </div>
  )
}

export default VinylSleeve
