import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getArtistImage } from '../../services/artistService.js'

export const PAGE_GUTTER = 'mx-auto w-full max-w-6xl px-4 tablet:px-6'
// Edge-to-edge pages (Home) use the same gutter on both sides at every width.
export const WIDE_GUTTER = 'w-full px-[max(1rem,4vw)]'

// Motion is skipped for reduced-motion and data-saver users; they get the still frame.
const prefersStill = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true

// Apple's motion heroes are HLS: Safari plays them natively, other browsers through hls.js (light build: no audio, captions or DRM needed), loaded only when needed.
const HeroVideo = ({ src, className }) => {
  const videoRef = useRef(null)
  const [playingSrc, setPlayingSrc] = useState(null)

  useEffect(() => {
    const video = videoRef.current
    // React doesn't reflect `muted` to the DOM, and browsers only autoplay muted video.
    video.muted = true
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return () => video.removeAttribute('src')
    }

    let hls
    let cancelled = false
    import('hls.js/light')
      .then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return
        hls = new Hls({ enableWorker: false, capLevelToPlayerSize: true })
        hls.loadSource(src)
        hls.attachMedia(video)
      })
      .catch(() => {
        // The still frame stays up if the player can't load.
      })
    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      aria-hidden="true"
      onPlaying={() => setPlayingSrc(src)}
      className={`${className} transition-opacity duration-1000 ${playingSrc === src ? 'opacity-100' : 'opacity-0'}`}
    />
  )
}

// Below the `tablet` breakpoint.
const PHONE = '(max-width: 1023px)'

// Full-bleed hero: the blurred album art shows at once, and the artist's photo fades in over it when found.
const Billboard = ({ artist, cover, children, className = 'tablet:min-h-[82svh]', gutter = PAGE_GUTTER }) => {
  const [loadedSrc, setLoadedSrc] = useState(null)
  const { data: artistArt } = useQuery({
    queryKey: ['artist-image', artist],
    queryFn: () => getArtistImage(artist),
    enabled: Boolean(artist),
    staleTime: Infinity,
    retry: false,
  })
  // The blurred cover only holds the space until the photo arrives, then recedes so it doesn't muddy the hero.
  const hasLoadedArt = Boolean(artistArt) && loadedSrc === artistArt.image
  // Phones get a square of art across the top that fades into the page, with the text starting on the fade.
  // Apple's square cut is art-directed for this; other wide art is cropped from the center, and square photos fit as they are.
  // From tablet up, wide editorial banners fill the hero; square press photos sit right and fade left so faces stay whole and clear of the text.
  const square = artistArt?.square
  const video = square && window.matchMedia(PHONE).matches ? square.video : artistArt?.video
  const artLayout = `absolute inset-x-0 top-0 h-[min(100vw,72svh)] w-full object-cover [mask-image:linear-gradient(black_60%,transparent)] tablet:h-full ${
    artistArt?.kind === 'editorial'
      ? 'tablet:inset-0 tablet:object-[50%_35%] tablet:[mask-image:none]'
      : 'object-[50%_25%] tablet:inset-y-0 tablet:left-auto tablet:right-0 tablet:aspect-[5/4] tablet:w-auto tablet:max-w-[75%] tablet:[mask-image:linear-gradient(to_right,transparent,black_45%)]'
  }`

  return (
    <section className={`relative isolate flex items-end overflow-hidden ${className}`}>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black">
        {cover ? (
          <img src={cover} alt="" decoding="async" className={`h-full w-full scale-125 object-cover blur-3xl saturate-150 transition-opacity duration-700 ${hasLoadedArt ? 'opacity-20' : 'opacity-50'}`} />
        ) : null}
        {artistArt ? (
          <picture key={artistArt.image}>
            {square ? <source media={PHONE} srcSet={square.image} /> : null}
            <img
              src={artistArt.image}
              alt=""
              decoding="async"
              onLoad={() => setLoadedSrc(artistArt.image)}
              className={`${artLayout} transition-opacity duration-700 ${loadedSrc === artistArt.image ? 'opacity-100' : 'opacity-0'}`}
            />
          </picture>
        ) : null}
        {video && !prefersStill() ? (
          <HeroVideo key={video} src={video} className={artLayout} />
        ) : null}
        <div
          className={`absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent ${artistArt?.kind === 'portrait' ? 'h-40 tablet:h-1/2 tablet:from-black/90' : 'h-40'}`}
        />
        {/* Phone text sits below the art, so only wider screens need the left shade behind it. */}
        <div className="absolute inset-0 hidden bg-gradient-to-r from-black/50 via-black/10 to-transparent tablet:block" />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/70 to-transparent" />
      </div>

      {/* On phones the art's height sets the hero: text begins 6rem into its fade, so there's no empty band to fill. */}
      <div className={`${gutter} pb-10 pt-[calc(min(100vw,72svh)-6rem)] tablet:pb-16 tablet:pt-32`}>
        {children}
      </div>
    </section>
  )
}

export default Billboard
