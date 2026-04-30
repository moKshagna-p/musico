import { memo, useRef } from 'react'
import { motion } from 'framer-motion'
import { prefetchReleaseDetails } from '../../services/discogsService.js'
import { useRatings } from '../../hooks/useRatings.js'
import { formatReleaseDate } from '../../utils/helpers.js'
import RatingStars from '../ui/RatingStars.jsx'
import CoverImage from '../ui/CoverImage.jsx'

const AlbumCard = ({ album, onSelect }) => {
  const MotionArticle = motion.article
  const { getCommunityStats } = useRatings()
  const prefetchTimerRef = useRef(null)
  const community = getCommunityStats(album)
  const genres = Array.isArray(album.genres) ? album.genres.filter(Boolean) : []
  const genreLabel = genres.slice(0, 2).join(' • ')

  const handleNavigate = () => {
    onSelect?.(album.id)
  }

  const handleMouseEnter = () => {
    prefetchTimerRef.current = setTimeout(() => {
      prefetchReleaseDetails(album.id)
    }, 100)
  }

  const handleMouseLeave = () => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current)
      prefetchTimerRef.current = null
    }
  }

  return (
    <MotionArticle
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      onClick={handleNavigate}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative flex cursor-pointer flex-col gap-4 rounded-3xl border border-outline bg-panel p-4 text-white transition hover:border-white/40"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black/40">
        <CoverImage
          src={album.cover}
          alt={album.name}
          width={320}
          height={320}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          loading="lazy"
          className="h-full w-full rounded-2xl object-contain p-2 transition duration-500 group-hover:scale-[1.02]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-display text-xl">{album.name}</h3>
        <p className="text-sm text-muted">{album.artists?.join(', ')}</p>
        {genreLabel ? (
          <p className="text-xs uppercase tracking-[0.22em] text-muted">{genreLabel}</p>
        ) : null}
        <p className="text-xs uppercase tracking-[0.22em] text-muted">
          {formatReleaseDate(album.releaseDate, album.releaseYear)}
        </p>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted">Community</p>
          <p className="text-xl font-semibold text-white tablet:text-2xl">
            {community.average.toFixed(1)}
          </p>
          <p className="text-xs text-muted">
            {community.total.toLocaleString()} ratings
          </p>
        </div>

        <RatingStars
          value={community.average}
          readOnly
          showValue={community.total > 0}
          size="sm"
        />
      </div>
    </MotionArticle>
  )
}

export default memo(AlbumCard)
