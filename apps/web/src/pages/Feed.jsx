import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiRefreshCw } from 'react-icons/fi'

import ActivityCard from '../components/ActivityCard.jsx'
import PageTransition from '../components/PageTransition.jsx'
import { useAuth } from '../hooks/useAuth.js'
import useFeed from '../hooks/useFeed.js'

const Feed = () => {
  const navigate = useNavigate()
  const { user, isPending } = useAuth()
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = useFeed()

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth')
    }
  }, [isPending, user, navigate])

  if (isPending || !user) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-2xl py-16 text-center text-muted">Loading...</div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-2xl py-4 tablet:py-8">
        <header className="flex items-center justify-between py-6 tablet:py-10">
          <h1 className="font-display text-3xl font-bold tablet:text-5xl">Feed</h1>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-white disabled:opacity-50"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
        </header>

        {loading && !items.length ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-outline bg-panel/50 p-8 text-center">
            <p className="text-muted">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-4 rounded-full border border-outline px-5 py-2 text-xs uppercase tracking-[0.2em] text-muted hover:text-white"
            >
              Try Again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-outline bg-panel/50 p-10 text-center">
            <p className="font-display text-xl font-bold">Your feed is empty</p>
            <p className="mt-3 text-sm text-muted">
              Follow other users to see their activity here. Discover music lovers who share
              your taste.
            </p>
            <button
              type="button"
              onClick={() => navigate('/discover')}
              className="mt-6 rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-canvas hover:opacity-90"
            >
              Discover Music
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ActivityCard key={item.id} item={item} />
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full rounded-xl border border-outline py-4 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-white disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}

export default Feed
