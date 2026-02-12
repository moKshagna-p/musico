import { useEffect, useMemo } from 'react'
import { FiArrowUpRight, FiDisc, FiLogOut, FiUser } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useRatings } from '../hooks/useRatings.js'

const LISTS_STORAGE_KEY = 'vaultLists'

const getSavedListsCount = () => {
  if (typeof window === 'undefined') return 0
  try {
    const stored = window.localStorage.getItem(LISTS_STORAGE_KEY)
    if (!stored) return 0
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

const Profile = () => {
  const navigate = useNavigate()
  const { user, isPending, signOutCurrentUser } = useAuth()
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

  const listsCount = useMemo(() => getSavedListsCount(), [])
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

  const handleSignOut = async () => {
    await signOutCurrentUser()
    navigate('/auth')
  }

  if (isPending || !user) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl rounded-3xl border border-outline bg-panel p-8 text-center text-muted">
          Loading profile...
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
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-muted">Profile Studio</p>
              <h1 className="mt-4 font-display text-4xl text-white tablet:text-5xl">
                Personal Listening Analytics
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
                A focused dashboard for your rating behavior and collection progress.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/discover')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white px-5 py-2 text-xs uppercase tracking-[0.3em] text-canvas transition hover:bg-white/90"
                >
                  Explore Music
                  <FiArrowUpRight />
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 rounded-full border border-outline px-5 py-2 text-xs uppercase tracking-[0.3em] text-muted transition hover:text-white"
                >
                  <FiLogOut />
                  Sign Out
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-outline bg-canvas/40 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Account</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline bg-panel text-muted">
                  <FiUser />
                </span>
                <div>
                  <p className="text-base text-white">{user.name || user.email}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">{user.email}</p>
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-outline/80 bg-panel/80 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted">Rating Momentum</p>
                <p className="mt-2 text-3xl font-semibold text-white">{ratingMomentum.toFixed(0)}%</p>
                <p className="mt-1 text-xs text-muted">Share of ratings that are 4.0 or higher.</p>
              </div>
            </div>
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
              <FiDisc className="h-16 w-16" />
            </div>
            <p className="text-xs uppercase tracking-[0.32em] text-muted">Lists</p>
            <p className="mt-3 text-4xl font-semibold text-white">{listsCount}</p>
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
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${(band.value / maxBandValue) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-right text-sm text-white">{band.value}</span>
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
            <div className="mt-3 rounded-2xl border border-outline bg-canvas/35 px-4 py-4">
              <p className="text-sm text-white">
                You currently have <span className="font-semibold">{listsCount}</span> saved list{listsCount === 1 ? '' : 's'}.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-outline px-4 py-5 text-sm text-muted">
              List analytics will appear once list creation is enabled.
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  )
}

export default Profile
