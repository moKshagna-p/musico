import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi'

import { morph } from '../../utils/morph.js'

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

const MediaLightbox = ({ items, index, onIndexChange, onClose, openerRef }) => {
  const dialogRef = useRef(null)
  const item = items[index]
  const step = useCallback((delta) => onIndexChange((index + delta + items.length) % items.length), [index, items.length, onIndexChange])

  useEffect(() => {
    const opener = openerRef.current
    const dialog = dialogRef.current
    dialog.showModal()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      dialog.close()
      opener?.focus({ preventScroll: true })
    }
  }, [openerRef])

  return createPortal(
    // Opening and closing animate as a View Transition (the tile zooms in, the page crossfades), see ReviewMedia.
    <dialog
      ref={dialogRef}
      aria-label="Image viewer"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll('button'))
          const edge = event.shiftKey ? buttons[0] : buttons.at(-1)
          if (document.activeElement === edge) {
            event.preventDefault()
            ;(event.shiftKey ? buttons.at(-1) : buttons[0]).focus()
          }
        }
        if (items.length > 1 && event.key === 'ArrowRight') { event.preventDefault(); step(1) }
        if (items.length > 1 && event.key === 'ArrowLeft') { event.preventDefault(); step(-1) }
      }}
      onClick={onClose}
      className="fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
    >
      <button
        autoFocus
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
        data-lightbox-image=""
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
    </dialog>,
    document.body,
  )
}

const ReviewMedia = ({ media = [] }) => {
  const [openIndex, setOpenIndex] = useState(null)
  const rootRef = useRef(null)
  const openerRef = useRef(null)
  const images = media.filter((item) => item.kind === 'image')
  const tile = (index) => rootRef.current?.querySelector(`[data-tile="${index}"]`)
  const lightboxImage = () => document.querySelector('[data-lightbox-image]')
  const open = (index) => {
    openerRef.current = tile(index)?.closest('button')
    morph(() => setOpenIndex(index), { from: tile(index), to: lightboxImage, name: 'review-media' })
  }
  // Shrinks back into whichever tile the viewer ended on.
  const close = useCallback(
    () => morph(() => setOpenIndex(null), { from: lightboxImage(), to: () => tile(openIndex), name: 'review-media' }),
    [openIndex],
  )

  if (!media.length) return null

  return (
    <div ref={rootRef} className="mt-4">
      <MediaGrid
        items={media}
        renderTile={(item, index) =>
          item.kind === 'gif' ? (
            <div className="relative h-full w-full">
              <img src={item.url} alt={item.alt || 'GIF'} width={item.width} height={item.height} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-paper">GIF</span>
            </div>
          ) : (
            <button type="button" onClick={() => open(index)} aria-label={item.alt ? `View image: ${item.alt}` : 'View image'} className="block h-full w-full">
              <img data-tile={index} src={item.url} alt={item.alt || ''} width={item.width} height={item.height} loading="lazy" decoding="async" className="h-full w-full object-cover transition-opacity hover:opacity-90" />
            </button>
          )
        }
      />
      {openIndex !== null && images[openIndex] && (
        <MediaLightbox items={images} index={openIndex} onIndexChange={setOpenIndex} onClose={close} openerRef={openerRef} />
      )}
    </div>
  )
}

export default ReviewMedia
