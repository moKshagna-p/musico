import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import AlbumGrid from '../components/AlbumGrid.jsx'
import PageTransition from '../components/PageTransition.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { useAlbums } from '../hooks/useAlbums.js'

const Discover = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('query') ?? ''

  const { albums, query, setQuery, loading, error } = useAlbums(initialQuery)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery, setQuery])

  const updateQuery = (value) => {
    setQuery(value)
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set('query', value)
    } else {
      params.delete('query')
    }
    setSearchParams(params, { replace: true })
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted">Catalog Explorer</p>
          <h1 className="font-display text-4xl">Dig through the vault</h1>
        </div>

        <SearchBar query={query} onSearch={updateQuery} />

        <AlbumGrid albums={albums} loading={loading} error={error} onSelect={(id) => navigate(`/album/${id}`)} />
      </div>
    </PageTransition>
  )
}

export default Discover
