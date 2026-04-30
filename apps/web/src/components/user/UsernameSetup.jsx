import { useCallback, useEffect, useState } from 'react'
import { FiCheck, FiX } from 'react-icons/fi'

import { checkUsernameAvailability, updateMyProfile } from '../../services/socialService.js'

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/

const UsernameSetup = ({ onComplete, onSkip }) => {
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState(null) // null | 'checking' | 'available' | 'taken' | 'invalid'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!username.trim()) {
      setStatus(null)
      return
    }

    const lower = username.trim().toLowerCase()
    if (!USERNAME_REGEX.test(lower)) {
      setStatus('invalid')
      return
    }

    setStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(lower)
        if (!result.valid) {
          setStatus('invalid')
        } else {
          setStatus(result.available ? 'available' : 'taken')
        }
      } catch {
        setStatus(null)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [username])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      if (status !== 'available' || saving) return

      setSaving(true)
      setError('')
      try {
        await updateMyProfile({ username: username.trim().toLowerCase() })
        onComplete?.()
      } catch (err) {
        setError(err?.message ?? 'Failed to set username.')
      } finally {
        setSaving(false)
      }
    },
    [username, status, saving, onComplete],
  )

  const statusIcon =
    status === 'available' ? (
      <FiCheck className="text-green-400" />
    ) : status === 'taken' || status === 'invalid' ? (
      <FiX className="text-red-400" />
    ) : null

  const statusText =
    status === 'checking'
      ? 'Checking...'
      : status === 'available'
        ? 'Available'
        : status === 'taken'
          ? 'Already taken'
          : status === 'invalid'
            ? '3-24 chars, lowercase letters, numbers, hyphens'
            : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-outline bg-panel p-8">
        <h2 className="font-display text-2xl font-bold">Choose your username</h2>
        <p className="mt-2 text-sm text-muted">
          This helps other users find and follow you. You can change it later.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username-input" className="block text-xs uppercase tracking-[0.2em] text-muted">
              Username
            </label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="yourname"
                autoComplete="off"
                autoFocus
                maxLength={24}
                className="w-full rounded-lg border border-outline bg-canvas py-3 pl-8 pr-10 text-white placeholder:text-muted/60 focus:border-white/30 focus:outline-none"
              />
              {statusIcon && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">{statusIcon}</span>
              )}
            </div>
            {statusText && (
              <p
                className={`mt-1.5 text-xs ${
                  status === 'available' ? 'text-green-400' : status === 'checking' ? 'text-muted' : 'text-red-400'
                }`}
              >
                {statusText}
              </p>
            )}
            {username.trim() && status === 'available' && (
              <p className="mt-1 text-xs text-muted">
                Findable as @{username.trim().toLowerCase()}
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={status !== 'available' || saving}
              className="flex-1 rounded-full bg-white py-3 text-xs font-semibold uppercase tracking-[0.2em] text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Set Username'}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full border border-outline px-5 py-3 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-white"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UsernameSetup
