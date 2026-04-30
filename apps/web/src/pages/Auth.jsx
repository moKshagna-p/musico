import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageTransition from '../components/ui/PageTransition.jsx'
import PageLoadingState from '../components/ui/PageLoadingState.jsx'
import { useAuth } from '../hooks/useAuth.js'

const Auth = () => {
  const navigate = useNavigate()
  const { user, signInWithEmail, signUpWithEmail, refreshSession, isPending } = useAuth()

  const [mode, setMode] = useState('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const title = useMemo(() => (mode === 'sign-in' ? 'Sign In' : 'Create Account'), [mode])
  const submitLabel = useMemo(
    () => (submitting ? (mode === 'sign-in' ? 'Signing In…' : 'Creating Account…') : title),
    [submitting, mode, title],
  )

  useEffect(() => {
    if (!isPending && user) {
      navigate('/', { replace: true })
    }
  }, [isPending, user, navigate])

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const payload = {
      email: email.trim(),
      password,
    }

    try {
      const result =
        mode === 'sign-in'
          ? await signInWithEmail(payload)
          : await signUpWithEmail({
              ...payload,
              name: name.trim() || email.trim().split('@')[0],
            })

      if (result?.error) {
        if (result.error.code === 'MAXIMUM_SESSIONS_REACHED') {
          setError('Try logging out in other account.')
        } else {
          setError(result.error.message ?? 'Unable to authenticate. Please try again.')
        }
        return
      }

      const sessionResult = await refreshSession()
      if (!sessionResult?.data?.user) {
        setError('Authentication succeeded, but the session could not be restored. Try signing in once more.')
        return
      }

      navigate('/', { replace: true })
    } catch {
      setError('Unable to authenticate. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isPending) {
    return (
      <PageTransition>
        <div aria-live="polite">
          <PageLoadingState title="Loading session" cards={1} compact />
        </div>
      </PageTransition>
    )
  }

  if (user) return null

  return (
    <PageTransition>
      <section className="mx-auto w-full max-w-xl px-2 py-8 tablet:py-14">
        <div className="overflow-hidden rounded-3xl border border-white/15 bg-panel/95 shadow-[0_24px_84px_rgba(0,0,0,0.5)]">
          <div className="border-b border-outline/80 bg-[linear-gradient(120deg,rgba(255,255,255,0.11),rgba(255,255,255,0.02)_52%,rgba(255,255,255,0.08))] px-5 py-6 tablet:px-8 tablet:py-8">
            <p className="text-xs uppercase tracking-[0.33em] text-muted">Musico Account</p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-white tablet:text-5xl">{title}</h1>
            <p className="mt-3 max-w-lg text-sm text-muted tablet:text-base">
              Access your ratings, lists, and listening profile.
            </p>
          </div>

          <div className="p-5 tablet:p-8">
            <div className="mb-6 grid grid-cols-2 rounded-full border border-outline bg-canvas p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('sign-in')
                  setError('')
                }}
                className={`rounded-full px-3 py-2 text-xs uppercase tracking-[0.22em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                  mode === 'sign-in' ? 'bg-white/12 text-white' : 'text-muted hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('sign-up')
                  setError('')
                }}
                className={`rounded-full px-3 py-2 text-xs uppercase tracking-[0.22em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                  mode === 'sign-up' ? 'bg-white/12 text-white' : 'text-muted hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {mode === 'sign-up' && (
                <div>
                  <label htmlFor="name" className="mb-1 block text-xs uppercase tracking-[0.3em] text-muted">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    className="w-full rounded-xl border border-outline bg-canvas px-4 py-3 text-white outline-none transition focus:border-white/35 focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
                    placeholder="Your Name"
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1 block text-xs uppercase tracking-[0.3em] text-muted">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  spellCheck={false}
                  className="w-full rounded-xl border border-outline bg-canvas px-4 py-3 text-white outline-none transition focus:border-white/35 focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-xs uppercase tracking-[0.3em] text-muted">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  className="w-full rounded-xl border border-outline bg-canvas px-4 py-3 text-white outline-none transition focus:border-white/35 focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p aria-live="polite" className="rounded-xl border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full border border-outline bg-white/10 px-4 py-3 text-xs uppercase tracking-[0.35em] text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLabel}
              </button>
            </form>
          </div>
        </div>
      </section>
    </PageTransition>
  )
}

export default Auth
