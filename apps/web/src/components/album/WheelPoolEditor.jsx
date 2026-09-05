import { useState } from 'react'
import { FiPlus, FiX } from 'react-icons/fi'
import { useSearch } from '../../hooks/useSearch.js'
import CoverImage from '../ui/CoverImage.jsx'

const WheelPoolEditor = ({ albums, lists, onAdd, onRemove, onClear }) => {
  const [query, setQuery] = useState('')
  const search = useSearch(query.trim(), { limit: 8 })
  const [listId, setListId] = useState('')
  const list = lists.find(item => String(item.id) === listId)
  const ids = new Set(albums.map(album => album.id))
  return (
    <div id="wheel-pool-editor" className="mt-5 rounded-2xl border border-outline bg-panel/60 p-5">
      <div className="grid gap-6 tablet:grid-cols-2">
        <div>
          <label htmlFor="wheel-list" className="text-sm font-semibold">Add a Musico list</label>
          <div className="mt-2 flex gap-2">
            <select id="wheel-list" value={listId} onChange={event => setListId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-outline bg-canvas p-3 text-sm">
              <option value="">Choose a list</option>
              {lists.map(item => <option key={item.id} value={item.id}>{item.name} ({item.albums?.length ?? 0})</option>)}
            </select>
            <button type="button" disabled={!list?.albums?.length} onClick={() => onAdd(list.albums)} className="rounded-xl border border-outline px-4 text-sm hover:bg-white/10 disabled:opacity-40">Add list</button>
          </div>
          <p className="mt-2 text-xs text-muted">Combine lists freely. Duplicate albums only get one spot.</p>
          {!lists.length && <p className="mt-2 text-sm text-muted">No lists yet. Search for albums to build your wheel.</p>}
        </div>
        <div>
          <label htmlFor="wheel-search" className="text-sm font-semibold">Add individual albums</label>
          <input id="wheel-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search an album or artist…" className="mt-2 w-full rounded-xl border border-outline bg-canvas p-3 text-sm" />
          {query.trim().length >= 3 && (
            <div className="mt-2 max-h-64 overflow-y-auto" aria-live="polite">
              {search.isFetching ? <p className="p-3 text-sm text-muted">Searching…</p> : search.isError ? <p className="p-3 text-sm">Search unavailable. <button type="button" onClick={() => search.refetch()} className="underline">Try again</button></p> : search.suggestions.length ? search.suggestions.map(album => (
                <button key={album.id} type="button" disabled={ids.has(String(album.id))} onClick={() => onAdd([album])} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5 disabled:opacity-45">
                  <CoverImage src={album.cover} alt="" className="h-10 w-10 rounded object-cover" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{album.name}</span><span className="block truncate text-xs text-muted">{album.artists?.join(', ')}</span></span>
                  {ids.has(String(album.id)) ? <span className="text-xs">Added</span> : <FiPlus aria-label="Add album" />}
                </button>
              )) : <p className="p-3 text-sm text-muted">No albums found. Try another title or artist.</p>}
            </div>
          )}
        </div>
      </div>
      <div className="mb-3 mt-6 flex items-center justify-between"><h3 className="text-sm font-semibold">In your wheel · {albums.length}</h3><button type="button" onClick={onClear} disabled={!albums.length} className="text-xs text-muted underline hover:text-white disabled:opacity-40">Clear wheel</button></div>
      <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
        {albums.map(album => <button key={album.id} type="button" onClick={() => onRemove(album.id)} aria-label={`Remove ${album.name}`} className="flex max-w-full items-center gap-2 rounded-full border border-outline py-1 pl-1 pr-3 text-xs hover:border-white/50"><CoverImage src={album.cover} alt="" className="h-7 w-7 rounded-full object-cover" /><span className="max-w-48 truncate">{album.name}</span><FiX aria-hidden="true" /></button>)}
        {!albums.length && <p className="text-sm text-muted">Add a list or your first album to start spinning.</p>}
      </div>
    </div>
  )
}
export default WheelPoolEditor
