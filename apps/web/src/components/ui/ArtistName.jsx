import { useQuery } from '@tanstack/react-query'

import { artistLogoImageUrl, getArtistLogo } from '../../services/artistService.js'
import { inkLogo } from '../../utils/logoInk.js'

// Logos show at most 80px tall, so 160px of source covers 2x screens.
const MAX_HEIGHT = 160

// Repaints the logo for our dark heroes (utils/logoInk.js) and returns it as a data URL.
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
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL()
}

// The artist's wordmark (TheAudioDB, then fanart.tv) in place of their name, for a single artist.
// The name shows until the logo is ready, and stays if there is none or it fails to load.
const ArtistName = ({ artists = [], className = '' }) => {
  const name = artists.join(', ')
  const solo = artists.length === 1 ? artists[0] : null
  const { data: logo } = useQuery({
    queryKey: ['artist-logo', solo],
    queryFn: async () => ((await getArtistLogo(solo)) ? loadInkedLogo(solo) : null),
    enabled: Boolean(solo),
    staleTime: Infinity,
    retry: false,
  })

  return (
    <p className={className}>
      {logo ? (
        <img
          src={logo}
          alt={name}
          // Logo PNGs carry transparent padding, so phones get a smaller box to keep the hero's rhythm.
          className="h-10 w-auto max-w-full object-contain object-left [filter:drop-shadow(0_2px_12px_rgb(0_0_0/0.5))] md:h-14 tablet:h-20"
        />
      ) : name}
    </p>
  )
}

export default ArtistName
