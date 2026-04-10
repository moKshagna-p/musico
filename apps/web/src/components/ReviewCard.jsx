import RatingStars from './RatingStars.jsx'

const ReviewCard = ({ review }) => {
  const { content, user: reviewer, rating, createdAt } = review

  const timeAgo = formatTimeAgo(createdAt)
  const displayName = reviewer?.name ?? 'Anonymous'
  const username = reviewer?.username

  return (
    <div className="rounded-xl border border-outline/60 bg-panel/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-outline/60 text-xs font-bold text-muted">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-semibold text-white">{displayName}</span>
            {username && (
              <span className="ml-1.5 text-xs text-muted">@{username}</span>
            )}
          </div>
        </div>

        {rating != null && (
          <RatingStars value={Number(rating)} readOnly size="sm" align="left" />
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/80">{content}</p>
      <p className="mt-2 text-xs text-muted">{timeAgo}</p>
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

export default ReviewCard
