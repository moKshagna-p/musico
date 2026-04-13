import { useState } from 'react'

const DEFAULT_FALLBACK_CLASS_NAME = 'bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]'

const CoverImage = ({ src, alt, className = '', fallbackClassName = DEFAULT_FALLBACK_CLASS_NAME, ...props }) => {
  const [failedSrc, setFailedSrc] = useState(null)

  if (!src || failedSrc === src) {
    return <div aria-hidden="true" className={`${className} ${fallbackClassName}`.trim()} />
  }

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  )
}

export default CoverImage
