import { useQuery } from '@tanstack/react-query'

import { artistLogoImageUrl, getArtistLogo } from '../../services/artistService.js'
import { inkLogo } from '../../utils/logoInk.js'

// Logos show at most 80px tall, so 160px of source covers 2x screens.
const MAX_HEIGHT = 160
// A missing logo may only mean its sources were down, so it is asked for again after this long.
const MISS_STALE_MS = 10 * 60 * 1000

// Logo files carry uneven transparent margins at the sides. Trimming them lines the wordmark itself up with the text
// around it, left-aligned or centered. Top and bottom stay, so every logo keeps the height its box was tuned for.
const opaqueColumns = ({ data, width, height }) => {
  let left = width
  let right = -1
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        left = Math.min(left, x)
        right = x
        break
      }
    }
  }
  return right < 0 ? null : { left, width: right - left + 1 }
}

// Repaints the logo for our dark heroes (utils/logoInk.js), trims its side margins and returns it as a data URL.
const loadInkedLogo = async (name) => {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = artistLogoImageUrl(name)
  await image.decode()
  const scale = Math.min(1, MAX_HEIGHT / image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  inkLogo(pixels.data)
  const columns = opaqueColumns(pixels)
  if (columns) canvas.width = columns.width
  context.putImageData(pixels, -(columns?.left ?? 0), 0)
  return canvas.toDataURL()
}

// The artist's wordmark (TheAudioDB, then fanart.tv) in place of their name, for a single artist.
// The name shows until the logo is ready, and stays if there is none or it fails to load.
// Logo PNGs carry transparent padding, so phones get a smaller box to keep the hero's rhythm.
const HERO_LOGO = 'h-10 md:h-14 tablet:h-20'

const ArtistName = ({ artists = [], className = '', logoClassName = HERO_LOGO }) => {
  const name = artists.join(', ')
  const solo = artists.length === 1 ? artists[0] : null
  const { data: logo } = useQuery({
    queryKey: ['artist-logo', solo],
    queryFn: async () => ((await getArtistLogo(solo)) ? loadInkedLogo(solo) : null),
    enabled: Boolean(solo),
    staleTime: (query) => (query.state.data ? Infinity : MISS_STALE_MS),
    retry: false,
  })

  return (
    <p className={className}>
      {logo ? (
        <img
          src={logo}
          alt={name}
          className={`${logoClassName} w-auto max-w-full object-contain object-left [filter:drop-shadow(0_2px_12px_rgb(0_0_0/0.5))]`}
        />
      ) : name}
    </p>
  )
}

export default ArtistName
