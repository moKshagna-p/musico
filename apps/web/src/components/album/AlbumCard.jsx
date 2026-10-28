import { memo, useRef } from 'react'
import { motion } from 'framer-motion'
import { FaStar } from 'react-icons/fa'
import { useRatings } from '../../hooks/useRatings.js'
import { formatReleaseDate } from '../../utils/helpers.js'
import { morph } from '../../utils/morph.js'
import VinylSleeve from '../ui/VinylSleeve.jsx'

const MotionArticle = motion.article

const AlbumCard = ({ album, onSelect }) => {
  const { getCommunityStats } = useRatings()
  const community = getCommunityStats(album)
  const genres = Array.isArray(album.genres) ? album.genres.filter(Boolean) : []
  const meta = [formatReleaseDate(album.releaseDate, album.releaseYear), genres[0]].filter(Boolean).join(', ')

  const sleeveRef = useRef(null)

  // The sleeve grows into the album page's sleeve.
  const handleNavigate = () => {
    if (!onSelect) return
    morph(() => onSelect(album.id, album), {
      from: sleeveRef.current?.querySelector('[data-sleeve]'),
      to: () => document.querySelector('[data-album-cover] [data-sleeve]'),
      name: 'album-cover',
    })
  }

  return (
    <MotionArticle
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleNavigate}
      onKeyDown={(event) => {
        if (event.key === 'Enter') handleNavigate()
      }}
      role={onSelect ? 'link' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `Open ${album.name}` : undefined}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-md text-paper focus-visible:outline-offset-4"
    >
      <VinylSleeve
        ref={sleeveRef}
        data-album-card={album.id}
        src={album.cover}
        label={album.discLabel}
        alt={album.name}
        pull="up"
        size={600}
        sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 18vw"
      />

      <div className="min-w-0">
        <h3 className="truncate font-display text-[17px] leading-tight" title={album.name}>{album.name}</h3>
        <p className="mt-0.5 truncate text-sm text-paper/65">{album.artists?.join(', ')}</p>
        <p className="mt-1.5 flex items-center gap-2.5 text-xs text-muted">
          {community.total > 0 && (
            <span
              className="inline-flex shrink-0 items-center gap-1 font-medium text-paper/85"
              title={`${community.total.toLocaleString()} ratings`}
            >
              <FaStar aria-hidden="true" className="h-2.5 w-2.5" />
              {community.average.toFixed(1)}
              <span className="sr-only">average from {community.total.toLocaleString()} ratings</span>
            </span>
          )}
          <span className="truncate">{meta}</span>
        </p>
      </div>
    </MotionArticle>
  )
}

export default memo(AlbumCard)
