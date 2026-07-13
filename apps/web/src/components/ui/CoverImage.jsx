import { useState } from 'react'

const DEFAULT_FALLBACK_CLASS_NAME = 'bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]'

const CoverImage = ({
  src,
  alt,
  className = '',
  fallbackClassName = DEFAULT_FALLBACK_CLASS_NAME,
  width = 320,
  height = 320,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  loading = 'lazy',
  ...props
}) => {
  const [failedSrc, setFailedSrc] = useState(null)
  const [loadedSrc, setLoadedSrc] = useState(null)
  const [prevSrc, setPrevSrc] = useState(src)

  // Reset load state during render when src changes, so a previously loaded
  // URL that cycles back (e.g. after cache eviction) still shows the placeholder.
  if (prevSrc !== src) {
    setPrevSrc(src)
    setLoadedSrc(null)
  }

  const isLoaded = loadedSrc === src

  if (!src || failedSrc === src) {
    return <div aria-hidden="true" className={`${className} ${fallbackClassName}`.trim()} />
  }

  return (
    <div className="relative overflow-hidden">
      {/* Lightweight placeholder (no extra network cost); crossfades with the image */}
      <div
        aria-hidden="true"
        className={`${className} pointer-events-none absolute inset-0 ${fallbackClassName} transition-opacity duration-300 ${isLoaded ? 'opacity-0' : 'animate-pulse opacity-100'}`.trim()}
      />

      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        loading={loading}
        decoding="async"
        className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoadedSrc(src)}
        onError={() => setFailedSrc(src)}
        {...props}
      />
    </div>
  )
}

export default CoverImage
