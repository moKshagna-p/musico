import { useEffect, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { FiArrowUpRight, FiDisc, FiLogOut } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useLists } from '../hooks/useLists.js'
import { useRatings } from '../hooks/useRatings.js'

const Profile = () => {
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const MotionDiv = motion.div
  const MotionAside = motion.aside
  const { user, isPending, signOutCurrentUser } = useAuth()
  const { lists } = useLists()
  const { ratings } = useRatings()

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth')
    }
  }, [isPending, user, navigate])

  const ratedItems = useMemo(
    () =>
      Object.entries(ratings ?? {})
        .map(([albumId, value]) => ({
          albumId,
          rating: Number(value?.rating ?? 0),
          timestamp: Number(value?.timestamp ?? 0),
        }))
        .filter((entry) => Number.isFinite(entry.rating) && entry.rating > 0)
        .sort((a, b) => b.timestamp - a.timestamp),
    [ratings],
  )

  const averageRating = useMemo(() => {
    if (!ratedItems.length) return 0
    const sum = ratedItems.reduce((total, entry) => total + entry.rating, 0)
    return sum / ratedItems.length
  }, [ratedItems])

  const listsCount = lists.length
  const highRatedCount = useMemo(() => ratedItems.filter((entry) => entry.rating >= 4).length, [ratedItems])
  const ratingMomentum = useMemo(() => {
    if (!ratedItems.length) return 0
    return (highRatedCount / ratedItems.length) * 100
  }, [highRatedCount, ratedItems.length])

  const ratingBands = useMemo(() => {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    ratedItems.forEach((entry) => {
      const bucket = Math.min(5, Math.max(1, Math.round(entry.rating)))
      distribution[bucket] += 1
    })
    return [
      { label: '5', value: distribution[5] },
      { label: '4', value: distribution[4] },
      { label: '3', value: distribution[3] },
      { label: '2', value: distribution[2] },
      { label: '1', value: distribution[1] },
    ]
  }, [ratedItems])

  const maxBandValue = useMemo(() => Math.max(1, ...ratingBands.map((band) => band.value)), [ratingBands])
  const recentLists = useMemo(
    () => [...lists].sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0)).slice(0, 4),
    [lists],
  )

  const handleSignOut = async () => {
    await signOutCurrentUser()
    navigate('/auth')
  }

  if (isPending || !user) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl rounded-3xl border border-outline bg-panel p-8 text-center text-muted">
          Loading profile…
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-outline bg-panel p-6 tablet:p-10">
          <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-8 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
          <div className="relative grid gap-8 tablet:grid-cols-[1.25fr,0.75fr]">
            <MotionDiv
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.38, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-xs uppercase tracking-[0.45em] text-muted">Profile Studio</p>
              <h1 className="mt-4 text-pretty font-display text-4xl text-white tablet:text-5xl">
                Personal Listening Analytics
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
                A focused dashboard for your rating behavior and collection progress.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/discover"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white px-5 py-2 text-xs uppercase tracking-[0.3em] text-canvas transition-colors duration-200 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  Explore Music
                  <FiArrowUpRight aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 rounded-full border border-outline px-5 py-2 text-xs uppercase tracking-[0.3em] text-muted transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <FiLogOut aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            </MotionDiv>

            <MotionAside
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.45, delay: shouldReduceMotion ? 0 : 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#171717,rgba(7,7,7,0.95)_55%)] p-5 shadow-panel tablet:p-6"
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(255,255,255,0.08),transparent_45%,rgba(255,255,255,0.02)_72%,transparent)]" />
              <div className="relative">
                <p className="text-xs uppercase tracking-[0.35em] text-muted">Account</p>
                <div className="mt-4 flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-base font-semibold uppercase text-white">
                    {(user.name || user.email).charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base text-white">{user.name || user.email}</p>
                    <p className="truncate text-xs uppercase tracking-[0.2em] text-muted">{user.email}</p>
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-white/10 py-4">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">Rated</dt>
                    <dd className="mt-1 text-2xl tabular-nums text-white">{ratedItems.length}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">Momentum</dt>
                    <dd className="mt-1 text-2xl tabular-nums text-white">{ratingMomentum.toFixed(0)}%</dd>
                  </div>
                </dl>

                <div className="mt-5">
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted">Rating Momentum</p>
                    <p className="text-sm tabular-nums text-white">{highRatedCount}/{ratedItems.length || 0}</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <MotionDiv
                      aria-hidden="true"
                      initial={shouldReduceMotion ? false : { transform: 'scaleX(0)' }}
                      animate={{ transform: `scaleX(${Math.min(1, Math.max(0, ratingMomentum / 100))})` }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.6, ease: [0.16, 1, 0.3, 1], delay: shouldReduceMotion ? 0 : 0.16 }}
                      style={{ transformOrigin: 'left center' }}
                      className="h-full w-full rounded-full bg-gradient-to-r from-white via-white to-[#8a8a8a]"
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted">Share of ratings that are 4.0 or higher.</p>
                </div>
              </div>
            </MotionAside>
          </div>
        </section>

        <section className="grid gap-4 tablet:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border border-outline bg-panel p-5">
            <div className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full border border-white/20" />
            <p className="text-xs uppercase tracking-[0.32em] text-muted">Albums Rated</p>
            <p className="mt-3 text-4xl font-semibold text-white">{ratedItems.length}</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-outline bg-panel p-5">
            <div className="pointer-events-none absolute -left-6 -top-6 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
            <p className="text-xs uppercase tracking-[0.32em] text-muted">Average Rating</p>
            <p className="mt-3 text-4xl font-semibold text-white">{averageRating.toFixed(1)}</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-outline bg-panel p-5">
            <div className="pointer-events-none absolute -bottom-4 -right-2 text-white/20">
              <FiDisc className="h-16 w-16" aria-hidden="true" />
            </div>
            <p className="text-xs uppercase tracking-[0.32em] text-muted">Lists</p>
            <p className="mt-3 text-4xl font-semibold tabular-nums text-white">{listsCount}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-outline bg-panel p-5 tablet:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Rating Spread</p>
              <h2 className="mt-2 font-display text-3xl text-white">How You Score Albums</h2>
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">
              High Ratings: {highRatedCount} / {ratedItems.length || 0}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {ratingBands.map((band) => (
              <div key={band.label} className="grid grid-cols-[42px,1fr,48px] items-center gap-3">
                <span className="text-xs uppercase tracking-[0.25em] text-muted">{band.label}.0</span>
                <div className="h-2 rounded-full bg-canvas/80">
                    <MotionDiv
                      className="h-full rounded-full bg-white"
                      initial={shouldReduceMotion ? false : { transform: 'scaleX(0)' }}
                      animate={{ transform: `scaleX(${band.value / maxBandValue})` }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.45, ease: [0.2, 0.9, 0.2, 1], delay: shouldReduceMotion ? 0 : 0.05 }}
                      style={{ transformOrigin: 'left center' }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-right text-sm tabular-nums text-white">{band.value}</span>
                </div>
              ))}
            </div>

          {!ratedItems.length && (
            <div className="mt-6 rounded-2xl border border-dashed border-outline px-4 py-5 text-center text-sm text-muted">
              Rate albums to populate your distribution analytics.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-outline bg-panel/70 p-5 tablet:p-7">
          <p className="text-xs uppercase tracking-[0.34em] text-muted">Collections</p>
          {listsCount > 0 ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-white">
                You currently have <span className="font-semibold tabular-nums">{listsCount}</span> saved list
                {listsCount === 1 ? '' : 's'}.
              </p>
              <div className="grid gap-3 tablet:grid-cols-2">
                {recentLists.map((list) => (
                  <article key={list.id} className="rounded-2xl border border-outline bg-canvas/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm text-white">{list.name}</p>
                      <p className="shrink-0 text-xs uppercase tracking-[0.24em] text-muted tabular-nums">
                        {list.albums.length}
                      </p>
                    </div>

                    {list.albums.length > 0 ? (
                      <div className="mt-3 flex -space-x-2">
                        {list.albums.slice(0, 3).map((entry) =>
                          entry.cover ? (
                            <img
                              key={`${list.id}-${entry.id}`}
                              src={entry.cover}
                              alt={entry.name}
                              width="44"
                              height="44"
                              loading="lazy"
                              className="h-11 w-11 rounded-xl border border-canvas object-cover"
                            />
                          ) : (
                            <span
                              key={`${list.id}-${entry.id}`}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-canvas bg-panel text-xs uppercase text-muted"
                              aria-hidden="true"
                            >
                              {entry.name.slice(0, 1)}
                            </span>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted">No albums in this list yet.</p>
                    )}
                  </article>
                ))}
              </div>
              {listsCount > recentLists.length && (
                <p className="text-xs uppercase tracking-[0.24em] text-muted tabular-nums">
                  +{listsCount - recentLists.length} more lists
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-outline px-4 py-5 text-sm text-muted">
              Create lists from album pages to start building your collection.
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  )
}

export default Profile
