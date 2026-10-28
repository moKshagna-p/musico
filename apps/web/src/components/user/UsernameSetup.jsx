import { useCallback, useState } from 'react'
import { FiCheck, FiX } from 'react-icons/fi'

import { USERNAME_STATUS_TEXT, cleanUsername, useUsernameStatus } from '../../hooks/useUsernameStatus.js'
import { updateMyProfile } from '../../services/socialService.js'

const UsernameSetup = ({ onComplete, onSkip }) => {
  const [username, setUsername] = useState('')
  const { status, retry: retryUsernameCheck } = useUsernameStatus(username)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      if (status !== 'available' || saving) return

      setSaving(true)
      setError('')
      try {
        await updateMyProfile({ username })
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

  const statusText = USERNAME_STATUS_TEXT[status] ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="mx-4 w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b0a]/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,1)] p-8">
        <h2 className="font-display text-3xl text-paper">Choose your username</h2>
        <p className="mt-2 text-sm text-muted">
          This helps other users find and follow you. You can change it later.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username-input" className="block text-sm text-muted">
              Username
            </label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(cleanUsername(e.target.value))}
                placeholder="yourname"
                autoComplete="off"
                autoFocus
                maxLength={24}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-8 pr-10 text-white placeholder:text-muted/60 focus:border-white/30 focus:outline-none"
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
                {status === 'error' && (
                  <button type="button" onClick={() => retryUsernameCheck()} className="ml-2 underline">
                    Retry username check
                  </button>
                )}
              </p>
            )}
            {status === 'available' && (
              <p className="mt-1 text-xs text-muted">
                Findable as @{username}
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={status !== 'available' || saving}
              className="flex-1 rounded-full bg-paper py-3 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Set Username'}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full border border-white/12 px-5 py-3 text-sm text-paper/80 transition-colors hover:border-white/30 hover:text-paper"
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
