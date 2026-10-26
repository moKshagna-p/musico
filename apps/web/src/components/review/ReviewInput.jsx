import { useCallback, useState } from 'react'

const ReviewInput = ({ initialContent = '', onSave, disabled = false }) => {
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
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] p-4 pb-8 text-[15px] text-paper placeholder:text-muted focus:border-white/30 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span
          className={`absolute bottom-3 right-3 text-xs ${
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
          className="rounded-full bg-paper px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {saving ? 'Saving...' : initialContent ? 'Update' : 'Post'}
        </button>
      </div>
    </form>
  )
}

export default ReviewInput
