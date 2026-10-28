import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageTransition from '../components/ui/PageTransition.jsx'
import SpinVinyl from '../components/ui/SpinVinyl.jsx'
import { AuthPageSkeleton } from '../components/ui/PageLoadingState.jsx'
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
  const [showVinyl, setShowVinyl] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const handleChange = (event) => setShowVinyl(event.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

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

      window.localStorage.setItem('musico:last-activity-at', String(Date.now()))
      const authUser = result?.data?.user
      const sessionResult = await refreshSession({ attempts: authUser ? 2 : 5, delayMs: 220 })
      if (!authUser && !sessionResult?.data?.user) {
        setError('Authentication succeeded, but the session is taking longer than expected. Refresh and try again.')
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
        <AuthPageSkeleton />
      </PageTransition>
    )
  }

  if (user) return null

  const tabClass = (active) =>
    `relative rounded-full px-3 py-2 text-sm transition-colors ${active ? 'text-black' : 'text-muted hover:text-paper'}`

  return (
    <PageTransition>
      <section className="relative mx-auto grid w-full max-w-5xl items-center gap-12 py-6 md:grid-cols-[1fr_minmax(0,26rem)] tablet:py-16">
        <div className="relative hidden md:block">
          {showVinyl && <SpinVinyl />}
        </div>

        <div>
          <h1 className="font-display text-5xl leading-none text-paper tablet:text-6xl">{title}</h1>
          <p className="mt-4 text-muted">
            {mode === 'sign-in' ? 'Welcome back. Your ratings, lists, and listening profile are waiting.' : 'Start rating records and building lists in under a minute.'}
          </p>

          <div className="relative mt-8 grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.03] p-1">
            <span
              aria-hidden="true"
              className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-paper transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${mode === 'sign-up' ? 'translate-x-full' : ''}`}
            />
            <button
              type="button"
              onClick={() => {
                setMode('sign-in')
                setError('')
              }}
              className={tabClass(mode === 'sign-in')}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('sign-up')
                setError('')
              }}
              className={tabClass(mode === 'sign-up')}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === 'sign-up' && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm text-muted">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-paper placeholder:text-muted/70 outline-none transition focus:border-white/35 focus:bg-white/[0.05] focus-visible:outline-none"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm text-muted">
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
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-paper placeholder:text-muted/70 outline-none transition focus:border-white/35 focus:bg-white/[0.05] focus-visible:outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm text-muted">
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
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-paper placeholder:text-muted/70 outline-none transition focus:border-white/35 focus:bg-white/[0.05] focus-visible:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p aria-live="polite" className="rounded-2xl border border-red-300/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-paper px-4 py-3.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLabel}
            </button>
          </form>
        </div>
      </section>
    </PageTransition>
  )
}

export default Auth
