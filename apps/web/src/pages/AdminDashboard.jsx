import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { FiAlertTriangle, FiSearch } from 'react-icons/fi'
import { Link, Navigate } from 'react-router-dom'

import { AdminDashboardPageSkeleton, AdminRowsSkeleton } from '../components/ui/PageLoadingState.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import { useAdminAccess } from '../hooks/useAdminAccess.js'
import { useAuth } from '../hooks/useAuth.js'
import { deleteAdminReview, fetchAdminOverview, fetchAdminReviews, fetchAdminUsers, setUserAdminRole } from '../services/adminService.js'

const SEARCH_DEBOUNCE_MS = 250
const REVIEW_FILTERS = [
  ['flagged', 'Flagged'],
  ['all', 'All'],
  ['clean', 'Clean'],
]
const EMPTY_REVIEWS = {
  flagged: 'Nothing flagged. The queue is clear.',
  all: 'No reviews yet.',
  clean: 'No clean reviews yet.',
}
const ACTIVITY_VERBS = { rated: 'rated', reviewed: 'reviewed', listed: 'listed', followed: 'followed someone' }

const formatRelative = (timestamp) => {
  if (!timestamp) return 'just now'
  const diff = Date.now() - Number(timestamp)
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

const count = (value) => Number(value ?? 0).toLocaleString()
const plural = (value, one, many) => (Number(value) === 1 ? one : many)

// One sentence for the week: the numbers carry the weight, the words stay quiet.
const WeekInReview = ({ metrics }) => {
  const parts = [
    [metrics.newUsers7d, plural(metrics.newUsers7d, 'person joined', 'people joined')],
    [metrics.ratings7d, plural(metrics.ratings7d, 'record was rated', 'records were rated')],
    [metrics.reviews7d, plural(metrics.reviews7d, 'review was written', 'reviews were written')],
    [metrics.searches7d, plural(metrics.searches7d, 'search ran', 'searches ran')],
  ]
  return (
    <p className="max-w-5xl font-display text-3xl leading-[1.15] tracking-[-0.01em] text-muted tablet:text-[2.75rem]">
      This week{' '}
      {parts.map(([value, words], index) => (
        <span key={words}>
          {index === parts.length - 1 ? 'and ' : ''}
          <span className="text-paper">{count(value)}</span>{'\u00a0'}{words}
          {index < parts.length - 2 ? ', ' : index === parts.length - 2 ? ' ' : '.'}
        </span>
      ))}
    </p>
  )
}

// A two-step button: the first press asks, the second acts. No browser dialogs.
const ConfirmButton = ({ label, confirmLabel, pendingLabel, pending, disabled, title, onConfirm }) => {
  const [asking, setAsking] = useState(false)

  if (pending) {
    return <span className="shrink-0 px-3 py-2 text-xs text-muted" aria-live="polite">{pendingLabel}</span>
  }

  if (asking) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="rounded-full px-3 py-2 text-xs text-muted transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper"
        >
          Cancel
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => {
            setAsking(false)
            onConfirm()
          }}
          className="rounded-full bg-paper px-3 py-2 text-xs font-medium text-black transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
        >
          {confirmLabel}
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      disabled={disabled}
      title={title}
      className="shrink-0 rounded-full border border-white/12 px-3 py-2 text-xs text-paper/85 transition hover:border-white/35 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/12"
    >
      {label}
    </button>
  )
}

const SectionTitle = ({ children, aside }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
    <h2 className="font-display text-2xl text-paper tablet:text-3xl">{children}</h2>
    {aside}
  </div>
)

const AdminDashboard = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { isAdmin, loadingAdmin } = useAdminAccess()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [pendingUserId, setPendingUserId] = useState('')
  const [reviewFilter, setReviewFilter] = useState('flagged')
  const [pendingReviewId, setPendingReviewId] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: fetchAdminOverview,
    enabled: isAdmin,
    staleTime: 1000 * 60,
  })

  const usersQuery = useQuery({
    queryKey: ['admin-users', debouncedQuery],
    queryFn: () => fetchAdminUsers({ q: debouncedQuery, limit: 24 }),
    enabled: isAdmin,
    staleTime: 1000 * 45,
  })

  const reviewsQuery = useQuery({
    queryKey: ['admin-reviews', reviewFilter],
    // The flag filter runs on the newest reviews the server returns, so ask for its maximum.
    queryFn: () => fetchAdminReviews({ status: reviewFilter, limit: 50 }),
    enabled: isAdmin,
    staleTime: 1000 * 30,
  })

  const users = Array.isArray(usersQuery.data) ? usersQuery.data : []
  const reviews = Array.isArray(reviewsQuery.data) ? reviewsQuery.data : []
  const overview = overviewQuery.data ?? {}
  const metrics = overview.metrics ?? {}
  const topQueries = Array.isArray(overview.topQueries) ? overview.topQueries : []
  const recentActivity = Array.isArray(overview.recentActivity) ? overview.recentActivity : []
  const topSearchCount = Math.max(1, ...topQueries.map((entry) => entry.searchCount))
  const totals = [
    ['members', count(metrics.totalUsers)],
    ['ratings', count(metrics.totalRatings)],
    ['reviews', count(metrics.totalReviews)],
    ['average', metrics.averageRating ? `${Number(metrics.averageRating).toFixed(1)}★` : '—'],
    ['lists', count(metrics.totalLists)],
    [plural(metrics.adminCount, 'admin', 'admins'), count(metrics.adminCount)],
  ]

  const handleToggleAdmin = async (person) => {
    if (!person?.userId || pendingUserId) return
    setPendingUserId(person.userId)
    setStatus('')

    try {
      const nextState = !person.isAdmin
      await setUserAdminRole(person.userId, nextState)
      setStatus(nextState ? `${person.name} is now an admin.` : `${person.name} is no longer an admin.`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-me'] }),
      ])
    } catch (error) {
      setStatus(error?.message ?? 'Admin access did not change. Try again.')
    } finally {
      setPendingUserId('')
    }
  }

  const handleDeleteReview = async (review) => {
    if (!review?.id || pendingReviewId) return
    setPendingReviewId(review.id)
    setStatus('')

    try {
      await deleteAdminReview(review.id)
      setStatus(`Removed review on ${review.albumName}.`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] }),
      ])
    } catch (error) {
      setStatus(error?.message ?? 'The review was not removed. Try again.')
    } finally {
      setPendingReviewId('')
    }
  }

  if (loadingAdmin) {
    return (
      <PageTransition>
        <AdminDashboardPageSkeleton />
      </PageTransition>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <PageTransition>
      <div className="space-y-14 tablet:space-y-20">
        <header className="space-y-8 pt-4 tablet:pt-10">
          <h1 className="font-display text-5xl leading-none text-paper tablet:text-7xl">Operations</h1>
          {overviewQuery.isLoading ? (
            <div className="space-y-3" aria-hidden="true">
              <div className="skeleton h-8 w-full max-w-4xl rounded-lg tablet:h-11" />
              <div className="skeleton h-8 w-2/3 rounded-lg tablet:h-11" />
            </div>
          ) : (
            <WeekInReview metrics={metrics} />
          )}
          <ul aria-label="All time" className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {totals.map(([label, value]) => (
              <li key={label} className="flex items-baseline gap-1.5">
                <span className="font-medium text-paper">{value}</span>{' '}
                <span className="text-muted">{label}</span>
              </li>
            ))}
          </ul>
        </header>

        <p aria-live="polite" className={status ? 'break-words border-l-2 border-paper/60 pl-3 text-sm text-paper' : 'sr-only'}>
          {status}
        </p>

        <div className="grid gap-14 tablet:grid-cols-12 tablet:gap-12">
          <section className="min-w-0 tablet:col-span-7" aria-labelledby="admin-reviews">
            <SectionTitle
              aside={
                <div role="group" aria-label="Filter reviews" className="flex rounded-full border border-white/10 p-1">
                  {REVIEW_FILTERS.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={reviewFilter === key}
                      onClick={() => setReviewFilter(key)}
                      className={`rounded-full px-3 py-1.5 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper ${
                        reviewFilter === key ? 'bg-paper text-black' : 'text-paper/70 hover:text-paper'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              <span id="admin-reviews">Reviews</span>
            </SectionTitle>

            <div className="divide-y divide-white/[0.07]">
              {reviewsQuery.isLoading ? (
                <AdminRowsSkeleton />
              ) : reviews.length ? (
                <AnimatePresence initial={false}>
                  {reviews.map((review) => (
                    <Motion.article
                      key={review.id}
                      layout
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`overflow-hidden py-5 ${review.isFlagged ? 'border-l-2 border-[#c6aa7e]/70 pl-4' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Link to={`/album/${review.albumId}`} className="truncate font-medium text-paper hover:underline">
                              {review.albumName}
                            </Link>
                            {review.isFlagged ? (
                              <span className="inline-flex items-center gap-1 text-xs text-[#e6d5b2]">
                                <FiAlertTriangle aria-hidden="true" /> Flagged words
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {review.userName}, {formatRelative(review.updatedAt)}
                          </p>
                          <p className="mt-3 max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-paper/85">{review.content}</p>
                        </div>
                        <ConfirmButton
                          label="Remove"
                          confirmLabel="Remove review"
                          pendingLabel="Removing"
                          pending={pendingReviewId === review.id}
                          onConfirm={() => handleDeleteReview(review)}
                        />
                      </div>
                    </Motion.article>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="py-12 text-sm text-muted">
                  <p>{EMPTY_REVIEWS[reviewFilter]}</p>
                  {reviewFilter === 'flagged' ? (
                    <button type="button" onClick={() => setReviewFilter('all')} className="mt-2 text-paper underline-offset-4 hover:underline">
                      See all reviews
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <div className="min-w-0 space-y-14 tablet:col-span-5">
            <section aria-labelledby="admin-members">
              <SectionTitle>
                <span id="admin-members">Members</span>
              </SectionTitle>
              <label className="mt-4 flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm focus-within:border-white/35">
                <FiSearch className="shrink-0 text-muted" aria-hidden="true" />
                <span className="sr-only">Search members</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, email or username"
                  className="w-full min-w-0 bg-transparent text-paper placeholder:text-muted/70 focus:outline-none"
                />
              </label>

              <div className="mt-2 divide-y divide-white/[0.07]">
                {usersQuery.isLoading ? (
                  <AdminRowsSkeleton />
                ) : users.length ? (
                  users.map((person) => {
                    const isSelf = person.userId === user?.id
                    return (
                      <article key={person.userId} className="flex items-center justify-between gap-3 py-4">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium text-paper">
                            <span className="truncate">{person.name}</span>
                            {person.isAdmin ? <span className="shrink-0 text-xs font-normal text-muted">admin</span> : null}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {person.username ? (
                              <Link to={`/profile/${person.username}`} className="hover:text-paper">@{person.username}</Link>
                            ) : null}
                            {person.username ? ' ' : ''}
                            {person.email}
                          </p>
                        </div>
                        <ConfirmButton
                          label={person.isAdmin ? 'Remove admin' : 'Make admin'}
                          confirmLabel={person.isAdmin ? 'Remove admin' : 'Make admin'}
                          pendingLabel="Updating"
                          pending={pendingUserId === person.userId}
                          disabled={person.isBootstrapAdmin || (isSelf && person.isAdmin)}
                          title={isSelf && person.isAdmin ? 'Another admin has to remove your access.' : undefined}
                          onConfirm={() => handleToggleAdmin(person)}
                        />
                      </article>
                    )
                  })
                ) : (
                  <p className="py-10 text-sm text-muted">No members match that search.</p>
                )}
              </div>
            </section>

            {topQueries.length ? (
              <section aria-labelledby="admin-searches">
                <SectionTitle>
                  <span id="admin-searches">Top searches</span>
                </SectionTitle>
                <ol className="mt-2">
                  {topQueries.map((entry, index) => (
                    <li key={entry.normalizedQuery} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 py-2 text-sm">
                      <span className="tabular-nums text-muted">{index + 1}</span>
                      <span className="relative min-w-0">
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 left-0 rounded-sm bg-white/[0.06]"
                          style={{ width: `${(entry.searchCount / topSearchCount) * 100}%` }}
                        />
                        <Link to={`/search?q=${encodeURIComponent(entry.query)}`} className="relative block truncate px-2 py-1 text-paper hover:underline">
                          {entry.query}
                        </Link>
                      </span>
                      <span className="tabular-nums text-muted">{count(entry.searchCount)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {recentActivity.length ? (
              <section aria-labelledby="admin-activity">
                <SectionTitle>
                  <span id="admin-activity">Recent activity</span>
                </SectionTitle>
                <ul className="mt-2 divide-y divide-white/[0.07]">
                  {recentActivity.map((entry) => (
                    <li key={entry.id} className="flex items-baseline justify-between gap-3 py-3 text-sm">
                      <p className="min-w-0 truncate text-muted">
                        <span className="text-paper">{entry.userName}</span> {ACTIVITY_VERBS[entry.type] ?? entry.type}
                        {entry.albumName ? <span className="text-paper"> {entry.albumName}</span> : null}
                      </p>
                      <span className="shrink-0 text-xs text-muted">{formatRelative(entry.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

export default AdminDashboard
