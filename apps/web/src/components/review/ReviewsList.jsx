import { useCallback, useEffect, useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'

import ReviewCard from './ReviewCard.jsx'
import { fetchAlbumReviews } from '../../services/socialService.js'

const ReviewsList = ({ albumId }) => {
  const [reviews, setReviews] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const result = await fetchAlbumReviews(albumId)
        if (!cancelled) {
          setReviews(result.reviews)
          setNextCursor(result.nextCursor)
        }
      } catch {
        // ignore
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
      // ignore
    } finally {
      setLoadingMore(false)
    }
  }, [albumId, nextCursor, loadingMore])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    )
  }

  if (!reviews.length) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        No reviews yet. Be the first to share your thoughts.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full rounded-xl border border-outline py-3 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-white disabled:opacity-50"
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
