import { useRef, useState } from 'react'
import { FiArrowLeft } from 'react-icons/fi'
import { useNavigate, useSearchParams } from 'react-router-dom'

import AlbumGrid from '../components/album/AlbumGrid.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import SearchBar from '../components/search/SearchBar.jsx'
import { useSearch } from '../hooks/useSearch.js'
import { useAuth } from '../hooks/useAuth.js'
import { addToSearchHistory } from '../services/searchHistoryService.js'
import { recordSearchSignal } from '../services/searchSignalService.js'

const SearchResults = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  
  const initialQuery = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [resultLimit, setResultLimit] = useState(12)
  const lastLoggedQueryRef = useRef('')

  // Professional Fetching with TanStack Query
  const { 
    suggestions: albums, 
    isLoading: loading, 
    isFetching,
    error, 
    correctedQuery,
    hasMore,
  } = useSearch(query, { 
    limit: resultLimit,
    enabled: !!query 
  })

  const logSearch = (value) => {
    const trimmed = value?.trim() ?? ''
    if (!trimmed) return

    const normalized = trimmed.toLowerCase()
    if (lastLoggedQueryRef.current === normalized) return
    lastLoggedQueryRef.current = normalized
    void recordSearchSignal(trimmed)
  }

  // Handle Search Submission
  const handleSearch = (newQuery) => {
    setQuery(newQuery)
    setResultLimit(12)
    if (newQuery?.trim()) {
      addToSearchHistory(newQuery, user?.id ?? 'guest')
      logSearch(newQuery)
      
      const params = new URLSearchParams()
      params.set('q', newQuery)
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
          <p className="text-xs uppercase tracking-[0.45em] text-muted font-bold">Search Results</p>
          <h1 className="mt-2 break-words font-display text-3xl tablet:text-5xl font-bold tracking-tight">
            {query ? `“${query}”` : 'Start searching'}
          </h1>
        </div>

        <SearchBar
          query={query}
          onSearch={handleSearch}
          autoFocus={!initialQuery}
          historyScope={user?.id ?? 'guest'}
        />

        {query && (
          <div className="mt-12">
            <AlbumGrid
              albums={albums}
              loading={loading}
              error={error?.message}
              correctedQuery={correctedQuery}
              onSelect={(id) => navigate(`/album/${id}`, { state: { from: '/search', query } })}
            />
            {!loading && !error && hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setResultLimit((current) => current + 12)}
                  disabled={isFetching}
                  className="rounded-full border border-outline px-6 py-3 text-xs font-bold uppercase tracking-[0.24em] text-white transition hover:border-white/40 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                >
                  {isFetching ? 'Loading' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}

export default SearchResults
