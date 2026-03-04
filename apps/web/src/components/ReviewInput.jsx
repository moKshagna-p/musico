import { useCallback, useState } from 'react'

const ReviewInput = ({ albumId, initialContent = '', onSave, disabled = false }) => {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const maxLength = 280

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      const trimmed = content.trim()
      if (!trimmed || saving || disabled) return

      setSaving(true)
      setStatus('')
      try {
        await onSave?.(trimmed)
        setStatus(initialContent ? 'Review updated.' : 'Review posted.')
      } catch (err) {
        setStatus(err?.message ?? 'Failed to save review.')
      } finally {
        setSaving(false)
      }
    },
    [content, saving, disabled, onSave, initialContent],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, maxLength))}
          placeholder="Write a short review..."
          disabled={disabled || saving}
          rows={3}
          className="w-full resize-none rounded-xl border border-outline bg-canvas/50 p-4 text-sm text-white placeholder:text-muted/50 focus:border-white/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span
          className={`absolute bottom-3 right-3 text-xs tabular-nums ${
            content.length > maxLength - 20 ? 'text-red-400' : 'text-muted/60'
          }`}
        >
          {content.length}/{maxLength}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted" aria-live="polite">
          {status}
        </p>
        <button
          type="submit"
          disabled={!content.trim() || saving || disabled}
          className="rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving ? 'Saving...' : initialContent ? 'Update' : 'Post'}
        </button>
      </div>
    </form>
  )
}

export default ReviewInput
