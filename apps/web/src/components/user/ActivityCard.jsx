import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import CoverImage from '../ui/CoverImage.jsx'

// Long sittings show a few albums and fold the rest behind a button, so one busy person can't flood the feed.
const VISIBLE_ALBUMS = 3

// One feed card: a person, when, and everything they did in that sitting (see groupFeed).
const ActivityCard = ({ group }) => {
  const { user: actor, albums, follows, createdAt } = group
  const [expanded, setExpanded] = useState(false)
  const folds = albums.length > VISIBLE_ALBUMS + 1 && !expanded
  const shown = folds ? albums.slice(0, VISIBLE_ALBUMS) : albums

  return (
    <article className="flex items-start gap-3.5 py-5">
      <PersonAvatar person={actor} />

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="flex items-baseline gap-2 text-[15px] leading-snug">
          <PersonName person={actor} />
          <time dateTime={new Date(createdAt).toISOString()} className="text-xs text-muted/70">
            {formatTimeAgo(createdAt)}
          </time>
        </p>

        {albums.length > 0 && (
          <ul className="mt-3 space-y-3">
            {shown.map((album) => (
              <AlbumEntry key={album.albumId} album={album} />
            ))}
          </ul>
        )}

        {folds && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-3 rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-muted transition-colors hover:border-white/25 hover:text-paper"
          >
            Show {albums.length - VISIBLE_ALBUMS} more
          </button>
        )}

        {follows.length > 0 && (
          <p className={`${albums.length ? 'mt-3' : 'mt-1'} text-sm text-muted`}>
            Started following{' '}
            {follows.map((person, index) => (
              <Fragment key={person.username ?? index}>
                {index > 0 && (index === follows.length - 1 ? ' and ' : ', ')}
                <PersonName person={person} />
              </Fragment>
            ))}
          </p>
        )}
      </div>
    </article>
  )
}

// Everything done to one album in a sitting, on one line: stars, review, and list adds.
const AlbumEntry = ({ album }) => {
  const { albumId, albumName, albumCover, rating, reviewed, snippet, lists } = album
  const actions = [
    rating > 0 && (
      <span key="rating" className="tracking-[0.15em] text-paper" aria-label={`Rated ${rating} out of 5 stars`}>
        {'★'.repeat(Math.floor(rating))}
        {rating % 1 ? '½' : ''}
      </span>
    ),
    reviewed && <span key="review">Reviewed</span>,
    ...lists.map((list) => (
      <span key={`list-${list.listId ?? list.listName}`}>
        Added to{' '}
        {list.listId ? (
          <Link to={`/lists/${list.listId}`} className="text-paper/90 hover:underline">{list.listName ?? 'a list'}</Link>
        ) : (
          <span className="text-paper/90">{list.listName ?? 'a list'}</span>
        )}
      </span>
    )),
  ].filter(Boolean)

  return (
    <li className="flex items-start gap-3">
      <Link to={`/album/${albumId}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
        <CoverImage
          src={albumCover}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          className="h-12 w-12 rounded-[3px] object-cover shadow-sleeve tablet:h-14 tablet:w-14"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/album/${albumId}`} className="block truncate font-medium text-paper hover:underline">
          {albumName || 'Untitled album'}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
          {actions.map((action, index) => (
            <Fragment key={action.key}>
              {index > 0 && <span aria-hidden="true" className="text-muted/40">·</span>}
              {action}
            </Fragment>
          ))}
        </p>
        {snippet && (
          <p className="mt-2 line-clamp-3 border-l border-white/15 pl-3 text-sm italic leading-relaxed text-paper/80">
            &ldquo;{snippet}&rdquo;
          </p>
        )}
      </div>
    </li>
  )
}

const PersonAvatar = ({ person }) => {
  const avatar = person?.image ? (
    <img src={person.image} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" />
  ) : (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-paper/60 ring-1 ring-white/10">
      {(person?.username ?? person?.name)?.charAt(0)?.toUpperCase() ?? '?'}
    </span>
  )
  return person?.username ? (
    <Link to={`/profile/${person.username}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
      {avatar}
    </Link>
  ) : (
    <span className="shrink-0" aria-hidden="true">{avatar}</span>
  )
}

// Usernames link to profiles; accounts created before signup asked for one fall back to their name.
const PersonName = ({ person }) =>
  person?.username ? (
    <Link to={`/profile/${person.username}`} className="font-medium text-paper hover:underline">
      {person.username}
    </Link>
  ) : (
    <span className="font-medium text-paper">{person?.name ?? 'Unknown'}</span>
  )

const formatTimeAgo = (timestamp) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export { PersonAvatar, PersonName }
export default ActivityCard
