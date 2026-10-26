import { memo } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowUpRight } from 'react-icons/fi'
import CoverImage from '../ui/CoverImage.jsx'

const ListCard = ({ list }) => {
  const albums = list.albums || []
  const displayAlbums = albums.slice(0, 4)
  const count = list.albumCount ?? albums.length

  return (
    <Link
      to={`/lists/${list.id}`}
      className="group relative block overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.035] tablet:p-6"
    >
      {/* Ambient tint from the first cover */}
      {displayAlbums[0]?.cover ? (
        <img
          src={displayAlbums[0].cover}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full object-cover opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-2xl leading-tight text-paper tablet:text-3xl">{list.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {count} {count === 1 ? 'album' : 'albums'}
          </p>
        </div>
        <FiArrowUpRight aria-hidden="true" className="mt-1 shrink-0 text-xl text-muted transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-paper" />
      </div>

      <div className="relative mt-8 flex h-24 items-end tablet:h-28">
        {displayAlbums.length > 0 ? (
          <div className="flex -space-x-8 tablet:-space-x-10">
            {displayAlbums.map((album, index) => (
              <div
                key={album.id || index}
                style={{ zIndex: displayAlbums.length - index, '--i': index }}
                className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-[3px] shadow-sleeve transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[calc(var(--i)*0.75rem)] tablet:w-28"
              >
                <CoverImage src={album.cover} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Empty for now. Add albums from any album page.</p>
        )}

        {count > 4 && (
          <span className="ml-auto self-end whitespace-nowrap rounded-full bg-white/[0.06] px-3 py-1 text-xs text-muted">
            +{count - 4} more
          </span>
        )}
      </div>
    </Link>
  )
}

export default memo(ListCard)
