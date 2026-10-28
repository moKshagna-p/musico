import { Link } from 'react-router-dom'
import CoverImage from '../ui/CoverImage.jsx'

// One feed row: who (avatar + username), what they did in one sentence, when, and the album on the right.
const ActivityCard = ({ item }) => {
  const { type, user: actor, albumId, albumName, albumCover, targetUser, metadata, createdAt } = item

  const albumLink = albumId ? (
    <Link to={`/album/${albumId}`} className="font-medium text-paper hover:underline">
      {albumName || 'an album'}
    </Link>
  ) : null

  const listLink = metadata?.listId ? (
    <Link to={`/lists/${metadata.listId}`} className="font-medium text-paper hover:underline">
      {metadata.listName ?? 'a list'}
    </Link>
  ) : (
    <span className="font-medium text-paper">{metadata?.listName ?? 'a list'}</span>
  )

  const sentence = {
    rated: <>rated {albumLink}</>,
    reviewed: <>reviewed {albumLink}</>,
    listed: <>added {albumLink} to {listLink}</>,
    followed: <>started following <PersonName person={targetUser} /></>,
  }[type]
  if (!sentence) return null

  const rating = Number(metadata?.rating ?? 0)

  return (
    <article className="flex items-start gap-3.5 py-5">
      <PersonAvatar person={actor} />

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[15px] leading-snug text-muted">
          <PersonName person={actor} /> {sentence}
        </p>
        {type === 'rated' && rating > 0 && (
          <p className="mt-1.5 text-sm tracking-[0.15em] text-paper" aria-label={`${rating} out of 5 stars`}>
            {'★'.repeat(Math.floor(rating))}
            {rating % 1 ? '½' : ''}
          </p>
        )}
        {type === 'reviewed' && metadata?.snippet && (
          <p className="mt-2 line-clamp-3 border-l border-white/15 pl-3 text-sm italic leading-relaxed text-paper/80">
            &ldquo;{metadata.snippet}&rdquo;
          </p>
        )}
        <time dateTime={new Date(createdAt).toISOString()} className="mt-1.5 block text-xs text-muted/70">
          {formatTimeAgo(createdAt)}
        </time>
      </div>

      {albumId && albumCover && (
        <Link to={`/album/${albumId}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
          <CoverImage
            src={albumCover}
            alt=""
            width={56}
            height={56}
            loading="lazy"
            className="h-14 w-14 rounded-[3px] object-cover shadow-sleeve tablet:h-16 tablet:w-16"
          />
        </Link>
      )}
    </article>
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

export default ActivityCard
