import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import { useAuth } from '../hooks/useAuth.js'

const Auth = () => {
  const navigate = useNavigate()
  const { user, signInWithEmail, signUpWithEmail, isPending } = useAuth()

  const [mode, setMode] = useState('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const title = useMemo(() => (mode === 'sign-in' ? 'Sign In' : 'Create Account'), [mode])

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
        setError(result.error.message ?? 'Unable to authenticate. Please try again.')
        return
      }

      navigate('/')
    } catch {
      setError('Unable to authenticate. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isPending) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-xl rounded-3xl border border-outline bg-panel p-6 text-center text-muted tablet:p-8">
          Loading session...
        </div>
      </PageTransition>
    )
  }

  if (user) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-xl rounded-3xl border border-outline bg-panel p-6 text-center tablet:p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-muted">Signed in as</p>
          <p className="mt-2 break-all text-xl text-white tablet:text-2xl">{user.email}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 rounded-full border border-outline px-5 py-2 text-xs uppercase tracking-[0.35em] text-muted transition hover:text-white"
          >
            Go Home
          </button>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-xl rounded-3xl border border-outline bg-panel p-5 tablet:p-8">
        <div className="mb-6 flex flex-col items-start gap-3 tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-4">
          <h1 className="font-display text-3xl text-white tablet:text-4xl">{title}</h1>
          <button
            type="button"
            onClick={() => {
              setMode((prev) => (prev === 'sign-in' ? 'sign-up' : 'sign-in'))
              setError('')
            }}
            className="text-xs uppercase tracking-[0.24em] text-muted transition hover:text-white tablet:tracking-[0.32em]"
          >
            {mode === 'sign-in' ? 'Need account?' : 'Have account?'}
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'sign-up' && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.3em] text-muted">Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="w-full rounded-xl border border-outline bg-canvas px-4 py-3 text-white outline-none focus:border-white/35"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.3em] text-muted">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border border-outline bg-canvas px-4 py-3 text-white outline-none focus:border-white/35"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.3em] text-muted">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              className="w-full rounded-xl border border-outline bg-canvas px-4 py-3 text-white outline-none focus:border-white/35"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full border border-outline bg-white/10 px-4 py-3 text-xs uppercase tracking-[0.35em] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Please wait...' : title}
          </button>
        </form>
      </div>
    </PageTransition>
  )
}

export default Auth
