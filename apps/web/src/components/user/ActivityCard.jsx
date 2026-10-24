import { Link } from 'react-router-dom'
import CoverImage from '../ui/CoverImage.jsx'
import ProfileLink from './ProfileLink.jsx'
import RatingStars from '../ui/RatingStars.jsx'

const ActivityCard = ({ item }) => {
  const { type, user: actor, albumId, albumName, albumCover, targetUser, metadata, createdAt } = item

  const timeAgo = formatTimeAgo(createdAt)

  const userLink = <ProfileLink username={actor?.username} className="font-medium text-paper hover:underline">{actor?.name ?? 'Unknown'}</ProfileLink>

  const albumLink = albumId ? (
    <Link to={`/album/${albumId}`} className="font-medium text-paper hover:underline">
      {albumName || 'an album'}
    </Link>
  ) : null

  const targetLink = targetUser ? <ProfileLink username={targetUser.username} className="font-medium text-paper hover:underline">{targetUser.name}</ProfileLink> : null

  const renderContent = () => {
    switch (type) {
      case 'rated': {
        const rating = Number(metadata?.rating ?? 0)
        return (
          <div className="text-[15px] leading-relaxed text-paper/75">
            {userLink} rated {albumLink}{' '}
            <span className="inline-flex align-middle">
              <RatingStars value={rating} readOnly size="sm" align="left" />
            </span>
          </div>
        )
      }
      case 'reviewed':
        return (
          <div>
            <p className="text-[15px] leading-relaxed text-paper/75">
              {userLink} reviewed {albumLink}
            </p>
            {metadata?.snippet && (
              <p className="mt-2 border-l border-white/15 pl-3 italic leading-snug text-paper/80">&ldquo;{metadata.snippet}&rdquo;</p>
            )}
          </div>
        )
      case 'listed':
        return (
          <p className="text-[15px] leading-relaxed text-paper/75">
            {userLink} added {albumLink} to{' '}
            <span className="font-medium text-white/90">{metadata?.listName ?? 'a list'}</span>
          </p>
        )
      case 'followed':
        return (
          <p className="text-[15px] leading-relaxed text-paper/75">
            {userLink} started following {targetLink}
          </p>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex gap-4 px-1 py-5 transition-colors hover:bg-white/[0.02]">
      {albumCover && (type === 'rated' || type === 'reviewed' || type === 'listed') ? (
        <Link to={`/album/${albumId}`} className="shrink-0">
          <CoverImage
            src={albumCover}
            alt={albumName ?? ''}
            width={56}
            height={56}
            loading="lazy"
            className="h-16 w-16 rounded-[3px] object-cover shadow-sleeve"
          />
        </Link>
      ) : actor?.image ? (
        <img
          src={actor.image}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-white/10"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-xl font-semibold text-paper/50 ring-1 ring-white/10" aria-hidden="true">
          {actor?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
      )}

      <div className="min-w-0 flex-1">
        {renderContent()}
        <p className="mt-1.5 text-xs text-muted">{timeAgo}</p>
      </div>
    </div>
  )
}

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
