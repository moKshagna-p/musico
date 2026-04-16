import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiSearch, FiShield, FiUserCheck, FiUserX } from 'react-icons/fi'
import { Navigate } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import { useAdminAccess } from '../hooks/useAdminAccess.js'
import { fetchAdminUsers, setUserAdminRole } from '../services/adminService.js'

const SEARCH_DEBOUNCE_MS = 250

const AdminDashboard = () => {
  const queryClient = useQueryClient()
  const { isAdmin, loadingAdmin } = useAdminAccess()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [pendingUserId, setPendingUserId] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query])

  const usersQuery = useQuery({
    queryKey: ['admin-users', debouncedQuery],
    queryFn: () => fetchAdminUsers({ q: debouncedQuery, limit: 30 }),
    enabled: isAdmin,
    staleTime: 1000 * 30,
  })

  const users = Array.isArray(usersQuery.data) ? usersQuery.data : []
  const adminCount = users.filter((entry) => entry.isAdmin).length

  if (loadingAdmin) {
    return (
      <PageTransition>
        <section className="space-y-4" aria-busy="true" aria-label="Loading admin dashboard">
          <div className="h-28 animate-pulse rounded-[2rem] border border-outline/70 bg-panel/40" />
          <div className="grid gap-4 tablet:grid-cols-2">
            <div className="h-24 animate-pulse rounded-2xl border border-outline/70 bg-panel/40" />
            <div className="h-24 animate-pulse rounded-2xl border border-outline/70 bg-panel/40" />
          </div>
        </section>
      </PageTransition>
    )
  }

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
        queryClient.invalidateQueries({ queryKey: ['admin-me'] }),
      ])
    } catch (error) {
      setStatus(error?.message ?? 'Unable to update admin access right now.')
    } finally {
      setPendingUserId('')
    }
  }

  if (!loadingAdmin && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <PageTransition>
      <section className="space-y-8">
        <header className="rounded-[2rem] border border-outline/70 bg-[radial-gradient(120%_130%_at_0%_0%,rgba(198,170,126,0.14),rgba(198,170,126,0.02)_38%,rgba(0,0,0,0)_70%),linear-gradient(170deg,rgba(8,8,8,0.98),rgba(6,6,6,0.95))] p-6 tablet:p-10">
          <p className="text-xs uppercase tracking-[0.35em] text-muted">Admin Dashboard</p>
          <h1 className="mt-2 font-display text-3xl leading-tight tablet:text-5xl">Access Control</h1>
          <p className="mt-2 text-sm text-white/70">Manage who can access admin tools.</p>
        </header>

        <div className="grid gap-4 tablet:grid-cols-2">
          <article className="rounded-2xl border border-outline/70 bg-panel/40 p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Visible Admins</p>
            <p className="mt-2 text-4xl font-semibold tabular-nums text-white">{adminCount}</p>
          </article>
          <article className="rounded-2xl border border-outline/70 bg-panel/40 p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Users Loaded</p>
            <p className="mt-2 text-4xl font-semibold tabular-nums text-white">{users.length}</p>
          </article>
        </div>

        <section className="rounded-3xl border border-outline/70 bg-panel/40 p-5 tablet:p-6">
          <div className="flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between">
            <h2 className="font-display text-2xl">User Roles</h2>
            <label className="flex items-center gap-2 rounded-xl border border-outline/60 bg-canvas/40 px-3 py-2 text-sm">
              <FiSearch className="text-white/60" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by email, name, username"
                className="w-full min-w-0 bg-transparent text-white placeholder:text-muted/60 focus:outline-none"
              />
            </label>
          </div>

          {status ? (
            <p className="mt-4 rounded-xl border border-outline/60 bg-canvas/35 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/80" aria-live="polite">
              {status}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {usersQuery.error ? (
              <p className="rounded-2xl border border-outline/55 bg-canvas/35 px-4 py-6 text-center text-sm text-muted">
                {usersQuery.error?.message ?? 'Unable to load users right now.'}
              </p>
            ) : null}

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

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
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
                        className="inline-flex items-center gap-2 rounded-full border border-outline/70 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/85 transition hover:border-white/45 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
        </section>
      </section>
    </PageTransition>
  )
}

export default AdminDashboard
