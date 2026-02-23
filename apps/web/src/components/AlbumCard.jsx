import { memo } from 'react'
import { motion } from 'framer-motion'
import { FiArrowUpRight } from 'react-icons/fi'

import { prefetchReleaseDetails } from '../services/discogsService.js'
import { useRatings } from '../hooks/useRatings.js'
import { formatReleaseDate } from '../utils/helpers.js'
import RatingStars from './RatingStars.jsx'

const AlbumCard = ({ album, onSelect }) => {
  const MotionArticle = motion.article
  const { getCommunityStats } = useRatings()
  const community = getCommunityStats(album)
  const genres = Array.isArray(album.genres) ? album.genres.filter(Boolean) : []
  const genreLabel = genres.slice(0, 2).join(' • ')

  const handleNavigate = () => {
    onSelect?.(album.id)
  }

  return (
    <MotionArticle
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      onClick={handleNavigate}
      onMouseEnter={() => prefetchReleaseDetails(album.id)}
      className="group relative flex cursor-pointer flex-col gap-4 rounded-3xl border border-outline bg-panel p-4 text-white transition hover:border-white/40"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black/40">
        <img
          src={album.cover}
          alt={album.name}
          width="320"
          height="320"
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
        />
      </div>

      <div className="flex items-center justify-end border-t border-outline pt-3 text-xs uppercase tracking-[0.3em] text-white">
        <span className="flex items-center gap-2">
          Details
          <FiArrowUpRight aria-hidden="true" />
        </span>
      </div>
    </MotionArticle>
  )
}

export default memo(AlbumCard)
