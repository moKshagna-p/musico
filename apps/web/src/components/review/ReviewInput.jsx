import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { FiImage, FiX } from 'react-icons/fi'

import GifPicker from './GifPicker.jsx'
import { MediaGrid } from './ReviewMedia.jsx'
import { prepareReviewImage } from './prepareReviewImage.js'
import { uploadReviewImage } from '../../services/socialService.js'

const MAX_IMAGES = 4
const MAX_LENGTH = 280
const EASE = [0.16, 1, 0.3, 1]
// Media and the GIF picker unfold under the text box and fold away when removed.
const UNFOLD = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.3, ease: EASE },
  className: 'overflow-hidden',
}
const POP = { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.3, ease: EASE } }

// Composer with tweet-style media: up to 4 images (pick, paste, or drop) or one GIF.
// Images upload as soon as they're added, so Post only has to attach them.
const ReviewInput = ({ initialContent = '', onSave, disabled = false }) => {
  const [content, setContent] = useState(initialContent)
  const [images, setImages] = useState([])
  const [gif, setGif] = useState(null)
  const [pickingGif, setPickingGif] = useState(false)
  const [editingAlt, setEditingAlt] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const fileInputRef = useRef(null)
  const imagesRef = useRef(images)
  imagesRef.current = images

  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview)), [])

  const patchImage = (localId, patch) =>
    setImages((current) => current.map((image) => (image.localId === localId ? { ...image, ...patch } : image)))

  const addFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/'))
      if (!files.length || disabled || saving) return
      if (gif) {
        setStatus('Remove the GIF to add images.')
        return
      }
      const room = MAX_IMAGES - imagesRef.current.length
      if (files.length > room) setStatus(`You can add up to ${MAX_IMAGES} images.`)
      else setStatus('')

      for (const file of files.slice(0, Math.max(room, 0))) {
        const localId = crypto.randomUUID()
        setImages((current) => [...current, { localId, preview: URL.createObjectURL(file), alt: '', status: 'uploading' }])
        prepareReviewImage(file)
          .then(async (prepared) => {
            patchImage(localId, { width: prepared.width, height: prepared.height })
            const uploaded = await uploadReviewImage(prepared)
            patchImage(localId, { id: uploaded.id, status: 'done' })
          })
          .catch((err) => patchImage(localId, { status: 'error', error: err?.message ?? 'Upload failed.' }))
      }
    },
    [disabled, gif, saving],
  )

  const removeImage = (localId) => {
    setImages((current) => {
      const removed = current.find((image) => image.localId === localId)
      if (removed) URL.revokeObjectURL(removed.preview)
      return current.filter((image) => image.localId !== localId)
    })
    if (editingAlt === localId) setEditingAlt(null)
  }

  const uploading = images.some((image) => image.status === 'uploading')
  const failed = images.some((image) => image.status === 'error')
  const hasMedia = images.length > 0 || Boolean(gif)
  const canPost = (content.trim() || hasMedia) && !uploading && !failed && !saving && !disabled

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      if (!canPost) return

      setSaving(true)
      setStatus('')
      try {
        await onSave?.({
          content: content.trim(),
          media: images.map((image) => ({ id: image.id, alt: image.alt.trim() })),
          gif: gif && { url: gif.url, width: gif.width, height: gif.height, alt: gif.title?.slice(0, 1000) ?? '' },
        })
        images.forEach((image) => URL.revokeObjectURL(image.preview))
        setContent('')
        setImages([])
        setGif(null)
        setEditingAlt(null)
        setStatus(initialContent ? 'Review updated.' : 'Review posted.')
      } catch (err) {
        setStatus(err?.message ?? 'Failed to save review.')
      } finally {
        setSaving(false)
      }
    },
    [canPost, onSave, content, images, gif, initialContent],
  )

  const altImage = images.find((image) => image.localId === editingAlt)

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false)
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return
        event.preventDefault()
        setDragging(false)
        addFiles(event.dataTransfer.files)
      }}
      className="space-y-3"
    >
      <div
        className={`rounded-2xl border bg-white/[0.03] transition-colors focus-within:border-white/30 ${
          dragging ? 'border-dashed border-white/40 bg-white/[0.06]' : 'border-white/10'
        }`}
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_LENGTH))}
          onPaste={(event) => {
            if (!event.clipboardData.files.length) return
            event.preventDefault()
            addFiles(event.clipboardData.files)
          }}
          placeholder="Write a short review..."
          aria-label="Review"
          disabled={disabled || saving}
          rows={3}
          className="block w-full resize-none bg-transparent p-4 text-[15px] text-paper placeholder:text-muted focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />

        <AnimatePresence initial={false}>
          {images.length > 0 && (
            <Motion.div key="images" {...UNFOLD}>
              <div className="px-4 pb-3">
                <MediaGrid
                  items={images}
                  renderTile={(image) => (
                    <Motion.div {...POP} className="relative h-full w-full bg-white/[0.04]">
                      <img src={image.preview} alt={image.alt} className={`h-full w-full object-cover ${image.status === 'uploading' ? 'opacity-50' : ''}`} />
                      {image.status === 'uploading' && (
                        <span className="absolute inset-0 m-auto h-6 w-6 animate-spin rounded-full border-2 border-paper/30 border-t-paper" aria-label="Uploading" />
                      )}
                      {image.status === 'error' && (
                        <p className="absolute inset-x-2 bottom-2 rounded-md bg-red-950/90 px-2 py-1 text-xs text-red-200">{image.error}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(image.localId)}
                        aria-label="Remove image"
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-paper backdrop-blur transition-colors hover:bg-black"
                      >
                        <FiX className="h-4 w-4" />
                      </button>
                      {image.status === 'done' && (
                        <button
                          type="button"
                          onClick={() => setEditingAlt(editingAlt === image.localId ? null : image.localId)}
                          aria-label={image.alt ? 'Edit image description' : 'Add image description'}
                          className={`absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur transition-colors hover:bg-black ${
                            image.alt ? 'text-paper' : 'text-paper/70'
                          }`}
                        >
                          {image.alt ? 'ALT ✓' : '+ALT'}
                        </button>
                      )}
                    </Motion.div>
                  )}
                />
                {altImage && (
                  <label className="mt-3 block">
                    <span className="text-xs text-muted">Describe this image for people who can&apos;t see it</span>
                    <input
                      autoFocus
                      value={altImage.alt}
                      onChange={(event) => patchImage(altImage.localId, { alt: event.target.value.replace(/[\r\n]+/g, ' ').slice(0, 1000) })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === 'Escape') {
                          event.preventDefault()
                          setEditingAlt(null)
                        }
                      }}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-paper focus:border-white/30 focus:outline-none"
                    />
                  </label>
                )}
              </div>
            </Motion.div>
          )}

          {gif && (
            <Motion.div key="gif" {...UNFOLD}>
              <div className="px-4 pb-3">
                <MediaGrid
                  items={[gif]}
                  renderTile={() => (
                    <Motion.div {...POP} className="relative h-full w-full">
                      <img src={gif.url} alt={gif.title || 'GIF'} className="h-full w-full object-cover" />
                      <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-paper">GIF</span>
                      <button
                        type="button"
                        onClick={() => setGif(null)}
                        aria-label="Remove GIF"
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-paper backdrop-blur transition-colors hover:bg-black"
                      >
                        <FiX className="h-4 w-4" />
                      </button>
                    </Motion.div>
                  )}
                />
              </div>
            </Motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1 border-t border-white/[0.07] px-2 py-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || saving || Boolean(gif) || images.length >= MAX_IMAGES}
            aria-label="Add images"
            title="Add images"
            className="flex h-9 w-9 items-center justify-center rounded-full text-paper/70 transition-colors hover:bg-white/10 hover:text-paper disabled:pointer-events-none disabled:opacity-30"
          >
            <FiImage className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => setPickingGif((open) => !open)}
            disabled={disabled || saving || images.length > 0 || Boolean(gif)}
            aria-label="Add a GIF"
            aria-expanded={pickingGif}
            title="Add a GIF"
            className="flex h-9 w-9 items-center justify-center rounded-full text-paper/70 transition-colors hover:bg-white/10 hover:text-paper disabled:pointer-events-none disabled:opacity-30"
          >
            <span className="rounded border-[1.5px] border-current px-1 text-[10px] font-bold leading-[14px]">GIF</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            multiple
            onChange={(event) => {
              addFiles(event.target.files)
              event.target.value = ''
            }}
            className="hidden"
          />
          <span className={`ml-auto pr-2 text-xs ${content.length > MAX_LENGTH - 20 ? 'text-red-400' : 'text-muted/60'}`}>
            {content.length}/{MAX_LENGTH}
          </span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {pickingGif && (
          <Motion.div {...UNFOLD}>
            <GifPicker
              onClose={() => setPickingGif(false)}
              onPick={(picked) => {
                setGif(picked)
                setPickingGif(false)
              }}
            />
          </Motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted" aria-live="polite">
          {uploading ? 'Uploading images...' : status}
        </p>
        <Motion.button
          type="submit"
          disabled={!canPost}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {saving && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/25 border-t-black" />}
          {saving ? 'Saving...' : initialContent ? 'Update' : 'Post'}
        </Motion.button>
      </div>
    </form>
  )
}

export default ReviewInput
