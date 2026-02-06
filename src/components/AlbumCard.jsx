import { memo } from 'react'
import { motion } from 'framer-motion'
import { FiArrowUpRight } from 'react-icons/fi'

import { prefetchReleaseDetails } from '../services/discogsService.js'
import { useRatings } from '../hooks/useRatings.js'
import { formatReleaseDate } from '../utils/helpers.js'
import RatingStars from './RatingStars.jsx'

const AlbumCard = ({ album, onSelect }) => {
  const { getUserRating, rateAlbum } = useRatings()
  const userRating = getUserRating(album.id)

  const handleNavigate = () => {
    onSelect?.(album.id)
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      onClick={handleNavigate}
      onMouseEnter={() => prefetchReleaseDetails(album.id)}
      className="group relative flex cursor-pointer flex-col gap-4 rounded-3xl border border-outline bg-panel p-4 text-white transition hover:border-white/40"
    >
      <div className="relative overflow-hidden rounded-2xl">
        <img
          src={album.cover}
          alt={album.name}
          loading="lazy"
          className="h-64 w-full rounded-2xl object-cover transition duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-display text-xl">{album.name}</h3>
        <p className="text-sm text-muted">{album.artists?.join(', ')}</p>
        <p className="text-xs uppercase tracking-[0.22em] text-muted">
          {formatReleaseDate(album.releaseDate, album.releaseYear)}
        </p>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted">Community</p>
          <p className="text-2xl font-semibold text-white">
            {(album.communityRating ?? 0).toFixed(1)}
          </p>
          <p className="text-xs text-muted">
            {(album.reviewCount ?? 0).toLocaleString()} reviews
          </p>
        </div>

        <RatingStars
          value={userRating ?? album.communityRating ?? 0}
          onRate={(value) => rateAlbum(album.id, value)}
          showValue
        />
      </div>

      <div className="flex items-center justify-end border-t border-outline pt-3 text-xs uppercase tracking-[0.3em] text-white">
        <span className="flex items-center gap-2">
          Details
          <FiArrowUpRight />
        </span>
      </div>
    </motion.article>
  )
}

export default memo(AlbumCard)
