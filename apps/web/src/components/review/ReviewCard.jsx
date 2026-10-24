import RatingStars from '../ui/RatingStars.jsx'

const ReviewCard = ({ review }) => {
  const { content, user: reviewer, rating, createdAt } = review

  const timeAgo = formatTimeAgo(createdAt)
  const displayName = reviewer?.name ?? 'Anonymous'
  const username = reviewer?.username

  return (
    <article className="border-b border-white/[0.07] py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-paper/70 ring-1 ring-white/10">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-medium text-paper">{displayName}</span>
            {username && (
              <span className="ml-1.5 text-xs text-muted">@{username}</span>
            )}
          </div>
        </div>

        {rating != null && (
          <RatingStars value={Number(rating)} readOnly size="sm" align="left" />
        )}
      </div>

      <p className="mt-4 text-[17px] leading-relaxed text-paper/90">{content}</p>
      {timeAgo && <p className="mt-3 text-xs text-muted">{timeAgo}</p>}
    </article>
  )
}

const formatTimeAgo = (timestamp) => {
  const date = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp)
  if (!Number.isFinite(date)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000))
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
