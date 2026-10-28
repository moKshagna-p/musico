import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi'

// Tweet-style layouts: one item keeps its shape, 2-4 share a 16:9 frame (the first of three runs full height).
const FRAME = 'grid aspect-[16/9] grid-cols-2 gap-0.5 overflow-hidden rounded-2xl border border-white/10'

export const MediaGrid = ({ items, renderTile }) => {
  if (!items.length) return null

  if (items.length === 1) {
    const [item] = items
    const ratio = item.width && item.height ? Math.min(Math.max(item.width / item.height, 0.75), 2.5) : 16 / 9
    return (
      <div className="relative w-full max-w-[34rem] overflow-hidden rounded-2xl border border-white/10">
        <div style={{ aspectRatio: ratio }} className="max-h-[32rem] w-full">
          {renderTile(item, 0)}
        </div>
      </div>
    )
  }

  return (
    <div className={`${FRAME} ${items.length > 2 ? 'grid-rows-2' : ''}`}>
      {items.map((item, index) => (
        <div key={item.localId ?? item.id ?? index} className={`relative min-h-0 ${items.length === 3 && index === 0 ? 'row-span-2' : ''}`}>
          {renderTile(item, index)}
        </div>
      ))}
    </div>
  )
}

const MediaLightbox = ({ items, index, onIndexChange, onClose }) => {
  const closeRef = useRef(null)
  const item = items[index]
  const step = useCallback((delta) => onIndexChange((index + delta + items.length) % items.length), [index, items.length, onIndexChange])

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (items.length > 1 && event.key === 'ArrowRight') step(1)
      if (items.length > 1 && event.key === 'ArrowLeft') step(-1)
    }
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [items.length, onClose, step])

  return createPortal(
    <Motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-paper transition-colors hover:bg-white/20"
      >
        <FiX className="h-5 w-5" />
      </button>

      <img
        src={item.url}
        alt={item.alt || ''}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85svh] max-w-full rounded-lg object-contain"
      />
      {item.alt && (
        <p onClick={(event) => event.stopPropagation()} className="mt-3 max-w-xl text-center text-sm text-paper/75">
          {item.alt}
        </p>
      )}

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); step(-1) }}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-paper transition-colors hover:bg-white/20"
          >
            <FiChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); step(1) }}
            aria-label="Next image"
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-paper transition-colors hover:bg-white/20"
          >
            <FiChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </Motion.div>,
    document.body,
  )
}

const ReviewMedia = ({ media = [] }) => {
  const [openIndex, setOpenIndex] = useState(null)
  const images = media.filter((item) => item.kind === 'image')
  const close = useCallback(() => setOpenIndex(null), [])

  if (!media.length) return null

  return (
    <div className="mt-4">
      <MediaGrid
        items={media}
        renderTile={(item, index) =>
          item.kind === 'gif' ? (
            <div className="relative h-full w-full">
              <img src={item.url} alt={item.alt || 'GIF'} width={item.width} height={item.height} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-paper">GIF</span>
            </div>
          ) : (
            <button type="button" onClick={() => setOpenIndex(index)} aria-label={item.alt ? `View image: ${item.alt}` : 'View image'} className="block h-full w-full">
              <img src={item.url} alt={item.alt || ''} width={item.width} height={item.height} loading="lazy" decoding="async" className="h-full w-full object-cover transition-opacity hover:opacity-90" />
            </button>
          )
        }
      />
      <AnimatePresence>
        {openIndex !== null && images[openIndex] && (
          <MediaLightbox items={images} index={openIndex} onIndexChange={setOpenIndex} onClose={close} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ReviewMedia
