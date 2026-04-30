import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiActivity, FiAlertTriangle, FiBarChart2, FiClock, FiSearch, FiShield, FiTrash2, FiUserCheck, FiUserX, FiUsers } from 'react-icons/fi'
import { Navigate } from 'react-router-dom'

import PageTransition from '../components/ui/PageTransition.jsx'
import { useAdminAccess } from '../hooks/useAdminAccess.js'
import { deleteAdminReview, fetchAdminOverview, fetchAdminReviews, fetchAdminUsers, setUserAdminRole } from '../services/adminService.js'

const SEARCH_DEBOUNCE_MS = 250

const formatRelative = (timestamp) => {
  if (!timestamp) return 'just now'
  const diff = Date.now() - Number(timestamp)
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

const AdminDashboard = () => {
  const queryClient = useQueryClient()
  const { isAdmin, loadingAdmin } = useAdminAccess()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [pendingUserId, setPendingUserId] = useState('')
  const [reviewFilter, setReviewFilter] = useState('all')
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
    staleTime: 1000 * 30,
  })

  const usersQuery = useQuery({
    queryKey: ['admin-users', debouncedQuery],
    queryFn: () => fetchAdminUsers({ q: debouncedQuery, limit: 30 }),
    enabled: isAdmin,
    staleTime: 1000 * 30,
  })

  const reviewsQuery = useQuery({
    queryKey: ['admin-reviews', reviewFilter],
    queryFn: () => fetchAdminReviews({ status: reviewFilter, limit: 16 }),
    enabled: isAdmin,
    staleTime: 1000 * 20,
  })

  const users = Array.isArray(usersQuery.data) ? usersQuery.data : []
  const reviews = Array.isArray(reviewsQuery.data) ? reviewsQuery.data : []
  const metrics = overviewQuery.data?.metrics ?? {
    totalUsers: 0,
    newUsers7d: 0,
    totalRatings: 0,
    ratings7d: 0,
    totalReviews: 0,
    reviews7d: 0,
    totalLists: 0,
    searches7d: 0,
    averageRating: 0,
    adminCount: users.filter((entry) => entry.isAdmin).length,
  }

  const modules = [
    { label: 'Users', value: metrics.totalUsers, hint: `+${metrics.newUsers7d} in 7d`, icon: FiUsers },
    { label: 'Ratings', value: metrics.totalRatings, hint: `+${metrics.ratings7d} in 7d`, icon: FiBarChart2 },
    { label: 'Reviews', value: metrics.totalReviews, hint: `+${metrics.reviews7d} in 7d`, icon: FiActivity },
    { label: 'Searches', value: metrics.searches7d, hint: 'last 7 days', icon: FiSearch },
  ]

  const handleToggleAdmin = async (person) => {
    if (!person?.userId || pendingUserId) return
    setPendingUserId(person.userId)
    setStatus('')

    try {
      const nextState = !person.isAdmin
      await setUserAdminRole(person.userId, nextState)
      setStatus(nextState ? `Granted admin to ${person.email}.` : `Removed admin from ${person.email}.`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-me'] }),
      ])
    } catch (error) {
      setStatus(error?.message ?? 'Unable to update admin access right now.')
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
      setStatus(error?.message ?? 'Unable to remove review right now.')
    } finally {
      setPendingReviewId('')
    }
  }

  if (loadingAdmin) {
    return (
      <PageTransition>
        <section className="space-y-4" aria-busy="true" aria-label="Loading admin dashboard">
          <div className="h-28 animate-pulse rounded-[2rem] border border-outline/70 bg-panel/40" />
          <div className="grid gap-4 tablet:grid-cols-2 laptop:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl border border-outline/70 bg-panel/40" />
            ))}
          </div>
        </section>
      </PageTransition>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <PageTransition>
      <section className="space-y-8">
        <header className="rounded-[2rem] border border-outline/70 bg-[radial-gradient(120%_130%_at_0%_0%,rgba(198,170,126,0.14),rgba(198,170,126,0.02)_38%,rgba(0,0,0,0)_70%),linear-gradient(170deg,rgba(8,8,8,0.98),rgba(6,6,6,0.95))] p-6 tablet:p-10">
          <p className="text-xs uppercase tracking-[0.35em] text-muted">Admin Dashboard</p>
          <h1 className="mt-2 font-display text-3xl leading-tight tablet:text-5xl">Trust & Operations</h1>
          <p className="mt-2 text-sm text-white/70">Moderate content, manage admins, and monitor platform health.</p>
        </header>

        <div className="grid gap-4 tablet:grid-cols-2 laptop:grid-cols-4">
          {modules.map((card) => {
            const Icon = card.icon
            return (
              <article key={card.label} className="rounded-2xl border border-outline/70 bg-panel/40 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted">{card.label}</p>
                  <Icon className="text-white/70" aria-hidden="true" />
                </div>
                <p className="mt-2 text-4xl font-semibold tabular-nums text-white">{Number(card.value ?? 0).toLocaleString()}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted">{card.hint}</p>
              </article>
            )
          })}
        </div>

        {status ? (
          <p
            className="break-words rounded-xl border border-outline/60 bg-canvas/35 px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-white/80 tablet:text-xs tablet:tracking-[0.16em]"
            aria-live="polite"
          >
            {status}
          </p>
        ) : null}

        <section className="grid gap-4 laptop:grid-cols-[1.15fr,0.85fr]">
          <div className="rounded-3xl border border-outline/70 bg-panel/40 p-5 tablet:p-6">
            <div className="flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between">
              <h2 className="font-display text-2xl">User Roles</h2>
              <label className="flex w-full items-center gap-2 rounded-xl border border-outline/60 bg-canvas/40 px-3 py-2 text-sm tablet:w-auto">
                <FiSearch className="text-white/60" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by email, name, username"
                  className="w-full min-w-0 bg-transparent text-white placeholder:text-muted/60 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {usersQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl border border-outline/55 bg-canvas/35" />
                ))
              ) : users.length ? (
                users.map((person) => {
                  const isPending = pendingUserId === person.userId
                  return (
                    <article
                      key={person.userId}
                      className="flex flex-col gap-3 rounded-2xl border border-outline/60 bg-canvas/35 p-4 tablet:flex-row tablet:items-center tablet:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{person.name}</p>
                        <p className="truncate text-xs text-muted">{person.email}</p>
                        {person.username ? <p className="mt-1 text-xs text-muted/80">@{person.username}</p> : null}
                      </div>

                      <div className="flex w-full flex-wrap items-center gap-2 tablet:w-auto tablet:justify-end">
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                            person.isAdmin ? 'border-white/40 bg-white/10 text-white' : 'border-outline/70 text-muted'
                          }`}
                        >
                          {person.isAdmin ? <FiShield aria-hidden="true" /> : <FiUserX aria-hidden="true" />}
                          {person.isAdmin ? 'Admin' : 'User'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleAdmin(person)}
                          disabled={isPending || person.isBootstrapAdmin}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-outline/70 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/85 transition hover:border-white/45 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 tablet:w-auto"
                        >
                          {person.isAdmin ? <FiUserX aria-hidden="true" /> : <FiUserCheck aria-hidden="true" />}
                          {isPending ? 'Updating' : person.isAdmin ? 'Remove' : 'Make Admin'}
                        </button>
                      </div>
                    </article>
                  )
                })
              ) : (
                <p className="rounded-2xl border border-outline/55 bg-canvas/35 px-4 py-6 text-center text-sm text-muted">
                  No users found for this search.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <article className="rounded-3xl border border-outline/70 bg-panel/40 p-5 tablet:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">Search Trends</h2>
                <FiSearch className="text-white/65" aria-hidden="true" />
              </div>
              <div className="mt-4 space-y-2">
                {(overviewQuery.data?.topQueries ?? []).slice(0, 6).map((entry) => (
                  <div key={entry.normalizedQuery} className="flex items-center justify-between gap-3 rounded-xl border border-outline/55 bg-canvas/35 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{entry.query}</p>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{formatRelative(entry.lastSearchedAt)}</p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-white">{entry.searchCount}</p>
                  </div>
                ))}
                {!overviewQuery.data?.topQueries?.length ? (
                  <p className="rounded-xl border border-outline/55 bg-canvas/35 px-3 py-4 text-center text-xs uppercase tracking-[0.16em] text-muted">
                    No search trend data yet
                  </p>
                ) : null}
              </div>
            </article>

            <article className="rounded-3xl border border-outline/70 bg-panel/40 p-5 tablet:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">Activity</h2>
                <FiClock className="text-white/65" aria-hidden="true" />
              </div>
              <div className="mt-4 space-y-2">
                {(overviewQuery.data?.recentActivity ?? []).slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-outline/55 bg-canvas/35 px-3 py-2">
                    <p className="text-sm text-white/90">{entry.userName}</p>
                    <p className="break-words text-xs uppercase tracking-[0.14em] text-muted">
                      {entry.type} {entry.albumName ? `· ${entry.albumName}` : ''} · {formatRelative(entry.createdAt)}
                    </p>
                  </div>
                ))}
                {!overviewQuery.data?.recentActivity?.length ? (
                  <p className="rounded-xl border border-outline/55 bg-canvas/35 px-3 py-4 text-center text-xs uppercase tracking-[0.16em] text-muted">
                    No recent activity
                  </p>
                ) : null}
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-3xl border border-outline/70 bg-panel/40 p-5 tablet:p-6">
          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
            <div>
              <h2 className="font-display text-2xl">Review Moderation</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">Remove spam/abusive content quickly</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-1 rounded-2xl border border-outline/70 bg-canvas/35 p-1 tablet:w-auto tablet:rounded-full">
              {[
                { key: 'all', label: 'All' },
                { key: 'flagged', label: 'Flagged' },
                { key: 'clean', label: 'Clean' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setReviewFilter(option.key)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] transition tablet:flex-none ${
                    reviewFilter === option.key ? 'bg-white text-canvas' : 'text-white/75 hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {reviewsQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl border border-outline/55 bg-canvas/35" />
              ))
            ) : reviews.length ? (
              reviews.map((review) => {
                const isPending = pendingReviewId === review.id
                return (
                  <article key={review.id} className="rounded-2xl border border-outline/60 bg-canvas/35 p-4">
                    <div className="flex flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-white">{review.albumName}</p>
                        <p className="text-xs text-muted">{review.userName} · {formatRelative(review.updatedAt)}</p>
                        <p className="line-clamp-3 text-sm text-white/85">{review.content}</p>
                      </div>

                      <div className="flex w-full flex-wrap items-center gap-2 tablet:w-auto tablet:justify-end">
                        {review.isFlagged ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#c6aa7e]/45 bg-[#c6aa7e]/12 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#e6d5b2]">
                            <FiAlertTriangle aria-hidden="true" /> Flagged
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(review)}
                          disabled={isPending}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-outline/70 px-4 py-2 text-xs uppercase tracking-[0.16em] text-white/85 transition hover:border-white/45 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 tablet:w-auto"
                        >
                          <FiTrash2 aria-hidden="true" />
                          {isPending ? 'Removing' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })
            ) : (
              <p className="rounded-2xl border border-outline/55 bg-canvas/35 px-4 py-6 text-center text-sm text-muted">
                No reviews matched this moderation filter.
              </p>
            )}
          </div>
        </section>
      </section>
    </PageTransition>
  )
}

export default AdminDashboard
