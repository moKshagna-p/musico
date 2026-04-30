import { useState, useRef, useEffect } from 'react'

const DEFAULT_FALLBACK_CLASS_NAME = 'bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]'

/**
 * Generate a low-quality placeholder image using canvas
 * Creates a tiny blurred version for blur-up effect
 */
const generateBlurPlaceholder = (src) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 10
    canvas.height = 10
    const ctx = canvas.getContext('2d')
    
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 10, 10)
      resolve(canvas.toDataURL('image/jpeg', 0.5))
    }
    img.onerror = () => {
      // Fallback: solid color
      ctx.fillStyle = 'rgba(100, 100, 100, 0.1)'
      ctx.fillRect(0, 0, 10, 10)
      resolve(canvas.toDataURL('image/jpeg', 0.5))
    }
    img.src = src
  })
}

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
  const [blurDataUrl, setBlurDataUrl] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const imgRef = useRef(null)

  // Generate blur placeholder on mount
  useEffect(() => {
    if (!src || failedSrc === src) return

    // Use a super-low quality version from the URL as blur placeholder
    // Vercel will cache this automatically
    const blurSrc = `${src}?w=10&q=1`
    
    generateBlurPlaceholder(blurSrc)
      .then(setBlurDataUrl)
      .catch(() => {
        // If blur generation fails, use a solid color
        setBlurDataUrl('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"%3E%3Crect fill="rgba(100,100,100,0.1)" width="10" height="10"/%3E%3C/svg%3E')
      })
  }, [src, failedSrc])

  if (!src || failedSrc === src) {
    return <div aria-hidden="true" className={`${className} ${fallbackClassName}`.trim()} />
  }

  return (
    <div className="relative overflow-hidden">
      {/* Blur placeholder while loading */}
      {blurDataUrl && !isLoaded && (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden="true"
          className={`${className} absolute inset-0 scale-110 blur-md`}
          style={{ filter: 'blur(10px)' }}
        />
      )}
      
      {/* Main optimized image */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        loading={loading}
        className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setFailedSrc(src)}
        {...props}
      />
    </div>
  )
}

export default CoverImage
