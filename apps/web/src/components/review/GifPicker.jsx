import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiSearch, FiX } from 'react-icons/fi'

import { searchGifs } from '../../services/socialService.js'

// Trending until you type; the API proxies KLIPY and caches, so keystrokes are debounced to spare its hourly cap.
const GifPicker = ({ onPick, onClose }) => {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])

  const { data: gifs = [], isPending, isError, error } = useQuery({
    queryKey: ['gifs', debounced],
    queryFn: ({ signal }) => searchGifs(debounced, { signal }),
    staleTime: 1000 * 60 * 5,
    retry: false,
  })

  return (
    <div
      className="rounded-2xl border border-white/10 bg-[#0b0b0a]"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2">
        <FiSearch className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 120))}
          placeholder="Search KLIPY"
          aria-label="Search GIFs"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-paper placeholder:text-muted focus:outline-none"
        />
        <button type="button" onClick={onClose} aria-label="Close GIF search" className="p-1 text-muted transition-colors hover:text-paper">
          <FiX className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        {isPending ? (
          <div className="columns-2 gap-2 sm:columns-3" aria-busy="true" aria-label="Loading GIFs">
            {[120, 90, 150, 100, 130, 80].map((height, index) => (
              <div key={index} style={{ height }} className="skeleton mb-2 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <p role="alert" className="px-2 py-8 text-center text-sm text-muted">
            {error?.status === 503 ? 'GIF search is not set up yet.' : 'GIFs could not be loaded right now.'}
          </p>
        ) : !gifs.length ? (
          <p className="px-2 py-8 text-center text-sm text-muted">No GIFs found.</p>
        ) : (
          <div className="columns-2 gap-2 sm:columns-3">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onPick(gif)}
                className="mb-2 block w-full overflow-hidden rounded-lg bg-white/[0.04] ring-white/40 transition hover:ring-2 focus-visible:ring-2"
                style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
              >
                <img src={gif.preview} alt={gif.title || 'GIF'} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="border-t border-white/[0.07] px-3 py-1.5 text-right text-[11px] text-muted/70">Powered by KLIPY</p>
    </div>
  )
}

export default GifPicker
