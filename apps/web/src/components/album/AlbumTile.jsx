import { FaStar } from 'react-icons/fa'
import { Link } from 'react-router-dom'

import VinylSleeve from '../ui/VinylSleeve.jsx'

// Linked cover + caption for user-owned collections (lists, ratings, history).
const AlbumTile = ({ to, cover, name, artist, rating, meta, headingLevel = 'h3' }) => {
  const Title = headingLevel
  return (
    // Seed the album page with what's shown here, so it opens with the cover in place (and the cover morphs into it).
    <Link
      to={to}
      state={{ album: { id: decodeURIComponent(to.slice('/album/'.length)), name, cover, artists: artist ? [artist] : [] } }}
      className="group block rounded-md"
    >
      <div className="pr-[12%] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1">
        <VinylSleeve src={cover} alt={name} size={320} sizes="(max-width: 768px) 50vw, 25vw" />
      </div>
      <Title className="mt-4 line-clamp-2 font-display text-xl leading-[1.1] text-paper">{name || 'Untitled album'}</Title>
      <p className="mt-1 truncate text-sm text-paper/70">{artist || 'Unknown artist'}</p>
      {(rating != null || meta) && (
        <p className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
          <span className="truncate">{meta}</span>
          {rating != null && (
            <span className="inline-flex shrink-0 items-center gap-1 text-paper">
              <FaStar aria-hidden="true" className="h-2.5 w-2.5" />
              {Number(rating).toFixed(1)}
            </span>
          )}
        </p>
      )}
    </Link>
  )
}

export default AlbumTile
