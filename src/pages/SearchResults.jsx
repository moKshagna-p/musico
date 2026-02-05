import { useEffect } from 'react'
import { FiArrowLeft } from 'react-icons/fi'
import { useNavigate, useSearchParams } from 'react-router-dom'

import AlbumGrid from '../components/AlbumGrid.jsx'
import PageTransition from '../components/PageTransition.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { useAlbums } from '../hooks/useAlbums.js'
import { addToSearchHistory } from '../services/searchHistoryService.js'

const SearchResults = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const { albums, query, setQuery, loading, error } = useAlbums(initialQuery)

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery)
      addToSearchHistory(initialQuery)
    }
  }, [initialQuery, setQuery])

  const updateQuery = (value) => {
    setQuery(value)
    if (value?.trim()) {
      addToSearchHistory(value)
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
        className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-muted hover:text-white"
      >
        <FiArrowLeft /> Back to Discover
      </button>

      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted">Search Results</p>
          <h1 className="font-display text-4xl">
            {query ? `"${query}"` : 'Start searching'}
          </h1>
        </div>

        <SearchBar query={query} onSearch={updateQuery} autoFocus />

        {query && (
          <AlbumGrid
            albums={albums}
            loading={loading}
            error={error}
            onSelect={(id) => navigate(`/album/${id}`, { state: { from: '/search', query } })}
          />
        )}
      </div>
    </PageTransition>
  )
}

export default SearchResults
