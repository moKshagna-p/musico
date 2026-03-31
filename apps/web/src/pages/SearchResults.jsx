import { useEffect, useRef } from 'react'
import { FiArrowLeft } from 'react-icons/fi'
import { useNavigate, useSearchParams } from 'react-router-dom'

import AlbumGrid from '../components/AlbumGrid.jsx'
import PageTransition from '../components/PageTransition.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { useAlbums } from '../hooks/useAlbums.js'
import { useAuth } from '../hooks/useAuth.js'
import { addToSearchHistory } from '../services/searchHistoryService.js'
import { recordSearchSignal } from '../services/searchSignalService.js'

const SearchResults = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, isPending } = useAuth()
  const historyScope = user?.id ?? 'guest'
  const enableHistory = !isPending && Boolean(user?.id)
  const initialQuery = searchParams.get('q') ?? ''
  const lastLoggedQueryRef = useRef('')

  const { albums, query, setQuery, loading, error, correctedQuery } = useAlbums(initialQuery)

  const logSearch = (value) => {
    const trimmed = value?.trim() ?? ''
    if (!trimmed) return

    const normalized = trimmed.toLowerCase()
    if (lastLoggedQueryRef.current === normalized) return
    lastLoggedQueryRef.current = normalized
    void recordSearchSignal(trimmed)
  }

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery)
      if (enableHistory) {
        addToSearchHistory(initialQuery, historyScope)
        logSearch(initialQuery)
      }
    }
  }, [enableHistory, historyScope, initialQuery, setQuery])

  const updateQuery = (value) => {
    setQuery(value)
    if (value?.trim()) {
      if (enableHistory) {
        addToSearchHistory(value, historyScope)
        logSearch(value)
      }
      const params = new URLSearchParams()
      params.set('q', value)
      setSearchParams(params, { replace: true })
    } else {
      navigate('/discover')
    }
  }

  return (
    <PageTransition>
      <button
        type="button"
        onClick={() => navigate('/discover')}
        className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted hover:text-white tablet:tracking-[0.4em]"
      >
        <FiArrowLeft /> Back to Discover
      </button>

      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted">Search Results</p>
          <h1 className="break-words font-display text-3xl tablet:text-4xl">
            {query ? `"${query}"` : 'Start searching'}
          </h1>
        </div>

        <SearchBar
          query={query}
          onSearch={updateQuery}
          autoFocus
          historyScope={historyScope}
          enableHistory={enableHistory}
        />

        {query && (
          <AlbumGrid
            albums={albums}
            loading={loading}
            error={error}
            correctedQuery={correctedQuery}
            onSelect={(id) => navigate(`/album/${id}`, { state: { from: '/search', query } })}
          />
        )}
      </div>
    </PageTransition>
  )
}

export default SearchResults
