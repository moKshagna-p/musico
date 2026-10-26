import { useCallback, useEffect, useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'

import ReviewCard from './ReviewCard.jsx'
import { fetchAlbumReviews } from '../../services/socialService.js'

const ReviewsList = ({ albumId }) => {
  const [reviews, setReviews] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(false)
      try {
        const result = await fetchAlbumReviews(albumId)
        if (!cancelled) {
          setReviews(result.reviews)
          setNextCursor(result.nextCursor)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [albumId])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await fetchAlbumReviews(albumId, { cursor: nextCursor })
      setReviews((prev) => [...prev, ...result.reviews])
      setNextCursor(result.nextCursor)
    } catch {
      setError(true)
    } finally {
      setLoadingMore(false)
    }
  }, [albumId, nextCursor, loadingMore])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-white/[0.06] bg-[length:240px_100%] motion-safe:animate-shimmer" />
        ))}
      </div>
    )
  }

  if (error && !reviews.length) {
    return <p role="alert" className="py-6 text-center text-sm text-muted">Reviews could not be loaded right now.</p>
  }

  if (!reviews.length) {
    return (
      <p className="py-6 text-sm text-muted">
        No reviews yet. Be the first to share your thoughts.
      </p>
    )
  }

  return (
    <div className="border-t border-white/[0.07]">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-6 w-full rounded-full border border-white/10 py-3 text-sm text-muted transition-colors hover:border-white/25 hover:text-paper disabled:opacity-50"
        >
          {loadingMore ? (
            <span className="inline-flex items-center gap-2">
              <FiRefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              Fetching reviews
            </span>
          ) : (
            'Load More Reviews'
          )}
        </button>
      )}
    </div>
  )
}

export default ReviewsList
