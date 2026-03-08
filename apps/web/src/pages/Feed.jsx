import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiLock, FiRefreshCw, FiSearch, FiX, FiUsers, FiMusic } from 'react-icons/fi'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

import ActivityCard from '../components/ActivityCard.jsx'
import FollowButton from '../components/FollowButton.jsx'
import PageTransition from '../components/PageTransition.jsx'
import { useAuth } from '../hooks/useAuth.js'
import useFeed from '../hooks/useFeed.js'
import { searchUsers } from '../services/socialService.js'

const Motion = motion

// ── User Search Panel ──

const UserSearchPanel = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  const handleSearch = useCallback(async (searchQuery) => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    setLoading(true)
    setHasSearched(true)
    try {
      const { users } = await searchUsers(trimmed)
      setResults(users)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = useCallback(
    (e) => {
      const value = e.target.value
      setQuery(value)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => handleSearch(value), 350)
    },
    [handleSearch],
  )

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setHasSearched(false)
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="relative">
      {/* Search Input */}
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 ${
          focused
            ? 'border-white/25 bg-white/[0.04] shadow-[0_0_20px_rgba(255,255,255,0.03)]'
            : 'border-outline/60 bg-panel/30'
        }`}
      >
        <FiSearch
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-colors duration-300 ${
            focused ? 'text-white/60' : 'text-muted/60'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          name="user-search"
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search for people to follow\u2026"
          aria-label="Search for users"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-white placeholder:text-muted/50 focus:outline-none focus-visible:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="shrink-0 rounded-full p-1 text-muted/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <FiX className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Search Results */}
      <AnimatePresence>
        {(hasSearched || loading) && (
          <Motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 overflow-hidden rounded-2xl border border-outline/60 bg-panel/60 backdrop-blur-sm"
            role="region"
            aria-label="Search results"
            aria-live="polite"
          >
            {loading ? (
              <div className="space-y-1 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-white/5" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-24 animate-pulse rounded bg-white/5" />
                      <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted/70">No users found for &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              <div className="p-2">
                {results.map((person, i) => (
                  <Motion.div
                    key={person.userId}
                    initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <UserSearchResult person={person} />
                  </Motion.div>
                ))}
              </div>
            )}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const UserSearchResult = ({ person }) => {
  return (
    <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
      {/* Avatar */}
      <Link to={`/u/${person.username}`} className="shrink-0">
        {person.image ? (
          <img
            src={person.image}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-white/60 ring-1 ring-white/10">
            {person.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to={`/u/${person.username}`}
            className="block truncate text-sm font-medium text-white transition-colors group-hover:text-white/90"
          >
            {person.name}
          </Link>
          {person.isPrivate && (
            <FiLock className="h-3 w-3 shrink-0 text-muted/50" aria-hidden="true" title="Private account" />
          )}
        </div>
        <p className="truncate text-xs text-muted/60">@{person.username}</p>
      </div>

      {/* Follow Button (don't show for self) */}
      {!person.isMe && (
        <div className="shrink-0">
          <FollowButton
            username={person.username}
            initialFollowing={person.isFollowing}
          />
        </div>
      )}
    </div>
  )
}

// ── Empty State ──

const EmptyFeed = ({ navigate }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <Motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mt-4 overflow-hidden rounded-2xl border border-outline/40"
    >
      {/* Decorative header band */}
      <div className="relative overflow-hidden bg-gradient-to-br from-white/[0.03] to-transparent px-8 pb-2 pt-10">
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/[0.02] blur-2xl" aria-hidden="true" />
        <div className="absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-white/[0.015] blur-xl" aria-hidden="true" />

        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
            <FiMusic className="h-6 w-6 text-white/50" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-white" style={{ textWrap: 'balance' }}>
              Your Feed Is Quiet
            </h2>
            <p className="mt-0.5 text-sm text-muted/70">
              Follow music lovers to see what they&rsquo;re listening to
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-0 px-8 py-6">
        <Step
          number="1"
          title="Find People"
          description="Use the search bar above to discover other users"
        />
        <Step
          number="2"
          title="Follow Them"
          description="Hit the follow button to see their activity"
        />
        <Step
          number="3"
          title="See Their Taste"
          description="Ratings, reviews, and lists will appear right here"
        />
      </div>

      <div className="border-t border-outline/40 px-8 py-5">
        <button
          type="button"
          onClick={() => navigate('/discover')}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-canvas transition-all hover:opacity-90 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <FiUsers className="h-3.5 w-3.5" aria-hidden="true" />
          Discover Music
        </button>
      </div>
    </Motion.div>
  )
}

const Step = ({ number, title, description }) => (
  <div className="flex items-start gap-4 py-3">
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-display text-xs font-bold text-white/50 ring-1 ring-white/10"
      aria-hidden="true"
    >
      {number}
    </span>
    <div className="pt-0.5">
      <p className="text-sm font-medium text-white/90">{title}</p>
      <p className="mt-0.5 text-xs text-muted/60">{description}</p>
    </div>
  </div>
)

// ── Feed Skeleton ──

const FeedSkeleton = () => (
  <div className="mt-6 space-y-3" aria-label="Loading feed\u2026" role="status">
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        className="flex gap-4 rounded-2xl border border-outline/30 bg-panel/30 p-4"
        style={{ animationDelay: `${i * 120}ms` }}
      >
        <div className="h-12 w-12 animate-pulse rounded-xl bg-white/5" />
        <div className="flex-1 space-y-2.5 py-1">
          <div className="h-3.5 w-3/5 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-2/5 animate-pulse rounded bg-white/5" />
        </div>
      </div>
    ))}
  </div>
)

// ── Main Feed Page ──

const Feed = () => {
  const navigate = useNavigate()
  const { user, isPending } = useAuth()
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = useFeed()
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth')
    }
  }, [isPending, user, navigate])

  if (isPending || !user) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-2xl py-16 text-center text-muted">Loading\u2026</div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-2xl py-2 tablet:py-6">
        {/* Header */}
        <header className="flex items-end justify-between pb-8 pt-4 tablet:pb-10 tablet:pt-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight tablet:text-5xl" style={{ textWrap: 'balance' }}>
              Feed
            </h1>
            <p className="mt-2 text-sm text-muted/70">
              See what your people are listening to
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh feed"
            className="group inline-flex items-center gap-2 rounded-full border border-outline/60 px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted transition-all hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-40"
          >
            <FiRefreshCw
              className={`h-3.5 w-3.5 transition-transform ${loading ? 'animate-spin' : 'group-hover:rotate-45'}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </header>

        {/* User Search */}
        <section className="mb-8" aria-label="User search">
          <UserSearchPanel />
        </section>

        {/* Feed Content */}
        <section aria-label="Activity feed">
          {loading && !items.length ? (
            <FeedSkeleton />
          ) : error ? (
            <Motion.div
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-outline/40 bg-panel/30 p-8 text-center"
              role="alert"
            >
              <p className="text-sm text-muted/70">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-4 rounded-full border border-outline/60 px-5 py-2 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                Try Again
              </button>
            </Motion.div>
          ) : items.length === 0 ? (
            <EmptyFeed navigate={navigate} />
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {items.map((item, i) => (
                  <Motion.div
                    key={item.id}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                    transition={{
                      delay: Math.min(i * 0.03, 0.3),
                      duration: 0.3,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    layout={!shouldReduceMotion}
                  >
                    <ActivityCard item={item} />
                  </Motion.div>
                ))}
              </AnimatePresence>

              {hasMore && (
                <Motion.button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  initial={shouldReduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full rounded-2xl border border-outline/40 py-4 text-xs uppercase tracking-[0.2em] text-muted/60 transition-all hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-40"
                >
                  {loadingMore ? (
                    <span className="inline-flex items-center gap-2">
                      <FiRefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                      Loading\u2026
                    </span>
                  ) : (
                    'Load More'
                  )}
                </Motion.button>
              )}
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  )
}

export default Feed
