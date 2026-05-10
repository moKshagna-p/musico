import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiAlertTriangle, FiSearch, FiShield, FiTrash2, FiUserCheck, FiUserX } from 'react-icons/fi'
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
    queryFn: () => fetchAdminReviews({ status: reviewFilter, limit: 18 }),
    enabled: isAdmin,
    staleTime: 1000 * 30,
  })

  const users = Array.isArray(usersQuery.data) ? usersQuery.data : []
  const reviews = Array.isArray(reviewsQuery.data) ? reviewsQuery.data : []
  const metrics = overviewQuery.data?.metrics ?? {}
  const stats = [
    ['Users', metrics.totalUsers],
    ['Ratings', metrics.totalRatings],
    ['Reviews', metrics.totalReviews],
    ['Admins', metrics.adminCount],
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
          <div className="h-20 animate-pulse rounded-2xl border border-outline/70 bg-panel/35" />
          <div className="grid gap-3 laptop:grid-cols-2">
            <div className="h-72 animate-pulse rounded-2xl border border-outline/70 bg-panel/35" />
            <div className="h-72 animate-pulse rounded-2xl border border-outline/70 bg-panel/35" />
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
      <section className="space-y-5">
        <header className="flex flex-col gap-4 border-b border-outline/70 pb-5 tablet:flex-row tablet:items-end tablet:justify-between">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.34em] text-muted">Admin</p>
            <h1 className="mt-1 font-display text-3xl leading-tight tablet:text-5xl">Operations</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 tablet:flex">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-outline/60 bg-panel/30 px-4 py-3">
                <p className="text-[0.62rem] uppercase tracking-[0.22em] text-muted">{label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-white">{Number(value ?? 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </header>

        {status ? (
          <p
            className="break-words rounded-xl border border-outline/60 bg-canvas/35 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/80"
            aria-live="polite"
          >
            {status}
          </p>
        ) : null}

        <section className="grid gap-4 laptop:grid-cols-2">
          <div className="rounded-2xl border border-outline/70 bg-panel/35 p-4 tablet:p-5">
            <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
              <h2 className="font-display text-2xl">Users</h2>
              <label className="flex w-full items-center gap-2 rounded-full border border-outline/60 bg-canvas/40 px-3 py-2 text-sm tablet:w-72">
                <FiSearch className="text-white/60" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search users"
                  className="w-full min-w-0 bg-transparent text-white placeholder:text-muted/60 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-4 divide-y divide-outline/55">
              {usersQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse bg-white/[0.03]" />
                ))
              ) : users.length ? (
                users.map((person) => {
                  const isPending = pendingUserId === person.userId
                  return (
                    <article key={person.userId} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{person.name}</p>
                        <p className="truncate text-xs text-muted">{person.email}</p>
                        {person.username ? <p className="truncate text-xs text-muted/80">@{person.username}</p> : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`hidden rounded-full border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.16em] tablet:inline-flex ${
                            person.isAdmin ? 'border-white/35 text-white' : 'border-outline/70 text-muted'
                          }`}
                        >
                          {person.isAdmin ? 'Admin' : 'User'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleAdmin(person)}
                          disabled={isPending || person.isBootstrapAdmin}
                          className="inline-flex items-center gap-2 rounded-full border border-outline/70 px-3 py-2 text-[0.65rem] uppercase tracking-[0.14em] text-white/85 transition hover:border-white/45 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {person.isAdmin ? <FiUserX aria-hidden="true" /> : <FiUserCheck aria-hidden="true" />}
                          {isPending ? 'Updating' : person.isAdmin ? 'Remove' : 'Admin'}
                        </button>
                      </div>
                    </article>
                  )
                })
              ) : (
                <p className="py-10 text-center text-sm text-muted">No users found.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-outline/70 bg-panel/35 p-4 tablet:p-5">
            <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
              <h2 className="font-display text-2xl">Reviews</h2>
              <div className="flex rounded-full border border-outline/70 bg-canvas/35 p-1">
                {[
                  ['all', 'All'],
                  ['flagged', 'Flagged'],
                  ['clean', 'Clean'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setReviewFilter(key)}
                    className={`rounded-full px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.16em] transition ${
                      reviewFilter === key ? 'bg-white text-canvas' : 'text-white/75 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 divide-y divide-outline/55">
              {reviewsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse bg-white/[0.03]" />
                ))
              ) : reviews.length ? (
                reviews.map((review) => {
                  const isPending = pendingReviewId === review.id
                  return (
                    <article key={review.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-white">{review.albumName}</p>
                            {review.isFlagged ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#c6aa7e]/45 px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.14em] text-[#e6d5b2]">
                                <FiAlertTriangle aria-hidden="true" /> Flag
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted">{review.userName} · {formatRelative(review.updatedAt)}</p>
                          <p className="mt-2 line-clamp-2 text-sm text-white/80">{review.content}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteReview(review)}
                          disabled={isPending}
                          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-outline/70 px-3 py-2 text-[0.65rem] uppercase tracking-[0.14em] text-white/85 transition hover:border-white/45 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {review.isFlagged ? <FiShield aria-hidden="true" /> : <FiTrash2 aria-hidden="true" />}
                          {isPending ? 'Removing' : 'Remove'}
                        </button>
                      </div>
                    </article>
                  )
                })
              ) : (
                <p className="py-10 text-center text-sm text-muted">No reviews matched this filter.</p>
              )}
            </div>
          </div>
        </section>
      </section>
    </PageTransition>
  )
}

export default AdminDashboard
