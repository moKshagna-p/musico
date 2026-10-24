import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getArtistImage } from '../../services/artistService.js'

export const PAGE_GUTTER = 'mx-auto w-full max-w-6xl px-4 tablet:px-6'
// Edge-to-edge pages (Home) use the same gutter on both sides at every width.
export const WIDE_GUTTER = 'w-full px-[max(1rem,4vw)]'

// Full-bleed hero: the blurred album art shows at once, and the artist's photo fades in over it when found.
const Billboard = ({ artist, cover, children, className = 'min-h-[82svh]', gutter = PAGE_GUTTER }) => {
  const [loadedSrc, setLoadedSrc] = useState(null)
  const { data: artistArt, isPending } = useQuery({
    queryKey: ['artist-image', artist],
    queryFn: () => getArtistImage(artist),
    enabled: Boolean(artist),
    staleTime: Infinity,
    retry: false,
  })
  const isResolving = Boolean(artist) && isPending
  // Wide editorial banners fill the hero; square press photos sit right and fade left so faces stay whole and clear of the text.
  const artLayout =
    artistArt?.kind === 'editorial'
      ? 'inset-0 w-full object-[50%_35%]'
      : 'inset-y-0 right-0 w-full object-[50%_25%] tablet:aspect-[5/4] tablet:w-auto tablet:max-w-[75%] tablet:[mask-image:linear-gradient(to_right,transparent,black_45%)]'

  return (
    <section className={`relative isolate flex items-end overflow-hidden ${className}`}>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black">
        {cover ? (
          <img src={cover} alt="" decoding="async" className="h-full w-full scale-125 object-cover opacity-50 blur-3xl saturate-150" />
        ) : null}
        {artistArt ? (
          <img
            key={artistArt.image}
            src={artistArt.image}
            alt=""
            decoding="async"
            onLoad={() => setLoadedSrc(artistArt.image)}
            className={`absolute h-full object-cover ${artLayout} transition-opacity duration-700 ${loadedSrc === artistArt.image ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : null}
        <div
          className={`absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent ${artistArt?.kind === 'portrait' ? 'h-1/2 from-black/90' : 'h-40'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/70 to-transparent" />
      </div>

      <div className={`${gutter} pb-10 pt-32 tablet:pb-16`}>
        {children({ hasArtistPhoto: Boolean(artistArt), isResolving })}
      </div>
    </section>
  )
}

export default Billboard
