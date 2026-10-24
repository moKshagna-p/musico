import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getArtistImage } from '../../services/artistService.js'
import { coverAt } from '../../utils/helpers.js'

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

// Full-bleed hero: the blurred album art shows at once, and the artist's photo fades in over it when found.
const Billboard = ({ artist, cover, children, className = 'min-h-[82svh]', gutter = PAGE_GUTTER }) => {
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
  // Wide editorial banners fill the hero; square press photos sit right and fade left so faces stay whole and clear of the text.
  const artLayout =
    artistArt?.kind === 'editorial'
      ? 'inset-0 w-full object-[50%_35%]'
      : 'inset-y-0 right-0 w-full object-[50%_25%] tablet:aspect-[5/4] tablet:w-auto tablet:max-w-[75%] tablet:[mask-image:linear-gradient(to_right,transparent,black_45%)]'

  return (
    <section className={`relative isolate flex items-end overflow-hidden ${className}`}>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black">
        {cover ? (
          <img src={coverAt(cover, 100)} alt="" decoding="async" className={`h-full w-full scale-125 object-cover blur-3xl saturate-150 transition-opacity duration-700 ${hasLoadedArt ? 'opacity-20' : 'opacity-50'}`} />
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
        {artistArt?.video && !prefersStill() ? (
          <HeroVideo key={artistArt.video} src={artistArt.video} className={`absolute h-full object-cover ${artLayout}`} />
        ) : null}
        <div
          className={`absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent ${artistArt?.kind === 'portrait' ? 'h-1/2 from-black/90' : 'h-40'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/70 to-transparent" />
      </div>

      <div className={`${gutter} pb-10 pt-32 tablet:pb-16`}>
        {children}
      </div>
    </section>
  )
}

export default Billboard
