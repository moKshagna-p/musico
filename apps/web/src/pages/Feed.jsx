import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiLock, FiRefreshCw, FiSearch, FiX, FiUsers, FiMusic } from 'react-icons/fi'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

import ActivityCard, { PersonAvatar, PersonName } from '../components/user/ActivityCard.jsx'
import CoverImage from '../components/ui/CoverImage.jsx'
import FollowButton from '../components/user/FollowButton.jsx'
import { FeedItemsSkeleton, FeedPageSkeleton } from '../components/ui/PageLoadingState.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import { useAuth } from '../hooks/useAuth.js'
import useFeed from '../hooks/useFeed.js'
import { searchUsers } from '../services/socialService.js'
import { feedDays, groupFeed } from '../services/feedGroups.js'

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
        className={`flex items-center gap-3 rounded-full border px-5 py-3 transition-all duration-300 ${
          focused
            ? 'border-white/30 bg-white/[0.06] shadow-[0_0_0_6px_rgba(238,234,227,0.05)]'
            : 'border-white/10 bg-white/[0.03]'
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
          placeholder="Search for people to follow…"
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
            className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm"
            role="region"
            aria-label="Search results"
            aria-live="polite"
          >
            {loading ? (
              <div className="space-y-1 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
                    <div className="skeleton h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3.5 w-24 rounded-full" />
                      <div className="skeleton h-3 w-16 rounded-full" />
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

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="block truncate text-sm font-medium text-white transition-colors group-hover:text-white/90">
            {person.name}
          </span>
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
      className="mt-4 overflow-hidden rounded-3xl border border-white/[0.07]"
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
            <h2 className="font-display text-3xl leading-none text-paper">
              Your feed is quiet
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
          className="inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
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
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-lg text-paper/50 ring-1 ring-white/10"
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

// ── Side Rail ──

const RailHeading = ({ className = '', children }) => (
  <h2 className={`mb-4 text-xs uppercase tracking-[0.2em] text-muted/80 ${className}`}>{children}</h2>
)

// What the people you follow are into lately, read off the feed already loaded. Your own activity is left out.
const CircleSummary = ({ items, meId }) => {
  const { albums, people } = useMemo(() => {
    const albumsById = new Map()
    const peopleById = new Map()
    for (const item of items) {
      if (item.userId === meId) continue
      const person = peopleById.get(item.userId) ?? { user: item.user, count: 0 }
      person.count += 1
      peopleById.set(item.userId, person)
      if (!item.albumId) continue
      const album = albumsById.get(item.albumId) ?? { albumId: item.albumId, albumName: item.albumName, albumCover: item.albumCover, people: new Map() }
      album.people.set(item.userId, item.user)
      albumsById.set(item.albumId, album)
    }
    // Sorts are stable, so ties keep feed order (most recent first).
    return {
      albums: [...albumsById.values()].sort((a, b) => b.people.size - a.people.size).slice(0, 4),
      people: [...peopleById.values()].sort((a, b) => b.count - a.count).slice(0, 3),
    }
  }, [items, meId])

  if (!albums.length) return null

  return (
    <div className="hidden space-y-10 tablet:block">
      <section aria-label="Lately in your circle">
        <RailHeading>Lately in your circle</RailHeading>
        <ul className="space-y-3">
          {albums.map((album) => {
            const [first] = album.people.values()
            return (
              <li key={album.albumId}>
                <Link to={`/album/${album.albumId}`} className="group flex items-center gap-3">
                  <CoverImage src={album.albumCover} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 shrink-0 rounded-[3px] object-cover shadow-sleeve" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-paper group-hover:underline">{album.albumName || 'Untitled album'}</span>
                    <span className="block truncate text-xs text-muted">
                      {album.people.size > 1 ? `${album.people.size} people` : first?.username ?? first?.name}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label="Most active">
        <RailHeading>Most active</RailHeading>
        <ul className="space-y-3">
          {people.map(({ user: person, count }) => (
            <li key={person?.username ?? person?.name} className="flex items-center gap-3">
              <PersonAvatar person={person} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm"><PersonName person={person} /></span>
                <span className="block text-xs text-muted">{count} {count === 1 ? 'update' : 'updates'}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ── Main Feed Page ──

const Feed = () => {
  const navigate = useNavigate()
  const { user, isPending } = useAuth()
  const { items, loading, loadingMore, error, hasMore, loadMore, refresh } = useFeed()
  const shouldReduceMotion = useReducedMotion()
  const days = useMemo(() => feedDays(groupFeed(items)), [items])

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth')
    }
  }, [isPending, user, navigate])

  if (isPending || !user) {
    return (
      <PageTransition>
        <FeedPageSkeleton />
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      {/* Phones stack header, search, feed; wider screens move search and the circle summary into a pinned side rail */}
      <div className="mx-auto grid w-full max-w-6xl py-2 [grid-template-areas:'head''rail''feed'] tablet:grid-cols-[minmax(0,1fr)_20rem] tablet:grid-rows-[auto_1fr] tablet:gap-x-16 tablet:py-6 tablet:[grid-template-areas:'head_rail''feed_rail']">
        {/* Header */}
        <header className="flex items-end justify-between gap-4 pb-8 pt-4 [grid-area:head] tablet:pb-10 tablet:pt-6">
          <div>
            <h1 className="font-display text-6xl leading-none text-paper tablet:text-7xl">
              Feed
            </h1>
            <p className="mt-3 text-muted">
              What the people you follow are rating, reviewing, and saving.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh feed"
            className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-white/30 hover:text-paper disabled:opacity-40"
          >
            <FiRefreshCw
              className={`h-3.5 w-3.5 transition-transform ${loading ? 'animate-spin' : 'group-hover:rotate-45'}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </header>

        <aside className="mb-8 space-y-10 [grid-area:rail] tablet:sticky tablet:top-24 tablet:mb-0 tablet:self-start tablet:pt-8">
          <section aria-label="User search">
            <RailHeading className="hidden tablet:block">Find people</RailHeading>
            <UserSearchPanel />
          </section>
          <CircleSummary items={items} meId={user.id} />
        </aside>

        {/* Feed Content */}
        <section aria-label="Activity feed" className="min-w-0 [grid-area:feed]">
          {loading && !items.length ? (
            <FeedItemsSkeleton />
          ) : error ? (
            <Motion.div
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-3xl border border-white/[0.07] p-8 text-center"
              role="alert"
            >
              <p className="text-sm text-muted/70">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-4 rounded-full border border-white/15 px-5 py-2 text-sm text-paper transition-colors hover:bg-white/[0.06]"
              >
                Try Again
              </button>
            </Motion.div>
          ) : items.length === 0 ? (
            <EmptyFeed navigate={navigate} />
          ) : (
            <>
              {days.map((day) => (
                <section key={day.label} aria-label={day.label}>
                  {/* Pinned just under the floating nav so a long scroll always says which day it's in */}
                  <h2 className="sticky top-16 z-10 border-b border-white/[0.06] bg-canvas/85 py-2.5 text-xs uppercase tracking-[0.2em] text-muted/80 backdrop-blur-md tablet:top-[4.25rem]">
                    {day.label}
                  </h2>
                  <div className="mb-8 divide-y divide-white/[0.06]">
                    {day.groups.map((group, i) => (
                      <Motion.div
                        key={group.id}
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <ActivityCard group={group} />
                      </Motion.div>
                    ))}
                  </div>
                </section>
              ))}

              {hasMore && (
                <Motion.button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  initial={shouldReduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 w-full rounded-full border border-white/10 py-3.5 text-sm text-muted transition-colors hover:border-white/25 hover:text-paper disabled:opacity-40"
                >
                  {loadingMore ? (
                    <span className="inline-flex items-center gap-2">
                      <FiRefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                      Fetching more
                    </span>
                  ) : (
                    'Load More'
                  )}
                </Motion.button>
              )}
            </>
          )}
        </section>
      </div>
    </PageTransition>
  )
}

export default Feed
