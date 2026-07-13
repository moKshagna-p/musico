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
  const isLoaded = loadedSrc === src

  if (!src || failedSrc === src) {
    return <div aria-hidden="true" className={`${className} ${fallbackClassName}`.trim()} />
  }

  return (
    <div className="relative overflow-hidden">
      {/* Lightweight placeholder while the image loads (no extra network cost) */}
      {!isLoaded && (
        <div aria-hidden="true" className={`${className} absolute inset-0 animate-pulse ${fallbackClassName}`.trim()} />
      )}

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
