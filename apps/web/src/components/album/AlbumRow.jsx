import { useRef } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

import AlbumCard from './AlbumCard.jsx'
import { WIDE_GUTTER } from '../ui/Billboard.jsx'
import { AlbumCardSkeleton } from '../ui/LoadingSkeleton.jsx'
import { createSkeletonArray } from '../../utils/helpers.js'

// Equal gutters on both sides; card width is solved so exactly --n cards fill the row (cqw = scroller content width).
const ROW_TRACK = '[container-type:inline-size] [--gap:1rem] tablet:[--gap:1.5rem] gap-[var(--gap)] px-[max(1rem,4vw)] scroll-px-[max(1rem,4vw)]'
const ITEM_WIDTH = 'w-[calc((100cqw-(var(--n)-1)*var(--gap))/var(--n))]'
const COLUMNS = {
  default: '[--n:2] sm:[--n:3] md:[--n:4] lg:[--n:5] xl:[--n:6]',
  ranked: '[--n:2] md:[--n:3] lg:[--n:4] xl:[--n:5]',
}

const ArrowButton = ({ direction, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={direction < 0 ? 'Scroll left' : 'Scroll right'}
    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-paper/80 transition-colors hover:border-white/30 hover:bg-white/[0.06] hover:text-paper"
  >
    {direction < 0 ? <FiChevronLeft aria-hidden="true" /> : <FiChevronRight aria-hidden="true" />}
  </button>
)

const AlbumRow = ({ title, note, albums = [], loading, error, onSelect, ranked = false }) => {
  const scroller = useRef(null)
  const scrollByPage = (direction) => {
    const node = scroller.current
    if (!node) return
    const style = getComputedStyle(node)
    const page = node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) + parseFloat(style.columnGap)
    node.scrollBy({ left: direction * page, behavior: 'smooth' })
  }

  return (
    <section>
      <div className={`${WIDE_GUTTER} mb-2 flex items-end justify-between gap-6`}>
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-none text-paper tablet:text-3xl">{title}</h2>
          {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
        </div>
        {albums.length > 4 && (
          <div className="hidden shrink-0 gap-2 md:flex">
            <ArrowButton direction={-1} onClick={() => scrollByPage(-1)} />
            <ArrowButton direction={1} onClick={() => scrollByPage(1)} />
          </div>
        )}
      </div>

      {error ? (
        <div className={`${WIDE_GUTTER} pt-6`}>
          <p className="rounded-2xl border border-white/[0.07] px-6 py-10 text-center text-sm text-muted">{error}</p>
        </div>
      ) : (
        // Top padding leaves room for the record that slides up out of each sleeve on hover.
        <div
          ref={scroller}
          className={`flex snap-x snap-mandatory overflow-x-auto pb-4 pt-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${ROW_TRACK} ${ranked ? COLUMNS.ranked : COLUMNS.default}`}
        >
          {loading
            ? createSkeletonArray(6).map((_, index) => (
                <div key={index} className={`${ITEM_WIDTH} shrink-0`}>
                  {ranked ? (
                    // Leaves the rank numeral's column empty so the cards land where they will sit.
                    <div className="flex">
                      <div className="w-[30%] shrink-0" />
                      <div className="-ml-[3%] min-w-0 flex-1">
                        <AlbumCardSkeleton />
                      </div>
                    </div>
                  ) : (
                    <AlbumCardSkeleton />
                  )}
                </div>
              ))
            : albums.map((album, index) => (
                <div key={`${album.id ?? 'album'}-${index}`} className={`${ITEM_WIDTH} shrink-0 snap-start`}>
                  {ranked ? (
                    <div className="flex items-start [container-type:inline-size]">
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none w-[30%] shrink-0 select-none text-right font-display ${index < 9 ? 'text-[60cqw]' : 'text-[40cqw]'} font-black leading-[0.8] tracking-[-0.09em] text-black [-webkit-text-stroke:2px_rgba(238,234,227,0.4)]`}
                      >
                        {index + 1}
                      </span>
                      <div className="relative -ml-[3%] min-w-0 flex-1">
                        <AlbumCard album={album} onSelect={onSelect} />
                      </div>
                    </div>
                  ) : (
                    <AlbumCard album={album} onSelect={onSelect} />
                  )}
                </div>
              ))}
          {!loading && !albums.length && (
            <p className="w-full rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-muted">
              Nothing here yet. Check back after the next chart update.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default AlbumRow
