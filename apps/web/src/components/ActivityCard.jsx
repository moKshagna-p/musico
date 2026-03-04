import { Link } from 'react-router-dom'
import { FaStar } from 'react-icons/fa'

const ActivityCard = ({ item }) => {
  const { type, user: actor, albumId, albumName, albumCover, targetUser, metadata, createdAt } = item

  const timeAgo = formatTimeAgo(createdAt)

  const userLink = actor?.username ? (
    <Link to={`/u/${actor.username}`} className="font-semibold text-white hover:underline">
      {actor.name}
    </Link>
  ) : (
    <span className="font-semibold text-white">{actor?.name ?? 'Unknown'}</span>
  )

  const albumLink = albumId ? (
    <Link to={`/album/${albumId}`} className="font-semibold text-white hover:underline">
      {albumName || 'an album'}
    </Link>
  ) : null

  const targetLink =
    targetUser?.username ? (
      <Link to={`/u/${targetUser.username}`} className="font-semibold text-white hover:underline">
        {targetUser.name}
      </Link>
    ) : targetUser ? (
      <span className="font-semibold text-white">{targetUser.name}</span>
    ) : null

  const renderContent = () => {
    switch (type) {
      case 'rated': {
        const rating = Number(metadata?.rating ?? 0)
        return (
          <p className="text-sm text-white/80">
            {userLink} rated {albumLink}{' '}
            <span className="inline-flex items-center gap-0.5 text-white/70">
              {Array.from({ length: 5 }).map((_, i) => (
                <FaStar
                  key={i}
                  className={`h-3 w-3 ${i < rating ? 'text-white' : 'text-white/20'}`}
                />
              ))}
            </span>
          </p>
        )
      }
      case 'reviewed':
        return (
          <div>
            <p className="text-sm text-white/80">
              {userLink} reviewed {albumLink}
            </p>
            {metadata?.snippet && (
              <p className="mt-1 text-sm italic text-muted">"{metadata.snippet}"</p>
            )}
          </div>
        )
      case 'listed':
        return (
          <p className="text-sm text-white/80">
            {userLink} added {albumLink} to{' '}
            <span className="font-medium text-white/90">{metadata?.listName ?? 'a list'}</span>
          </p>
        )
      case 'followed':
        return (
          <p className="text-sm text-white/80">
            {userLink} started following {targetLink}
          </p>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex gap-4 rounded-xl border border-outline/60 bg-panel/50 p-4 transition-colors hover:bg-panel/80">
      {albumCover && (type === 'rated' || type === 'reviewed' || type === 'listed') ? (
        <Link to={`/album/${albumId}`} className="shrink-0">
          <img
            src={albumCover}
            alt={albumName ?? ''}
            className="h-14 w-14 rounded-lg object-cover"
          />
        </Link>
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-outline/50 text-lg font-bold text-muted">
          {actor?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
      )}

      <div className="min-w-0 flex-1">
        {renderContent()}
        <p className="mt-1 text-xs text-muted">{timeAgo}</p>
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
