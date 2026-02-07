import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AlbumGrid from '../components/AlbumGrid.jsx'
import PageTransition from '../components/PageTransition.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { getRecentPopularReleases } from '../services/discogsService.js'

const Discover = () => {
  const navigate = useNavigate()
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadFeatured = async () => {
      setLoading(true)
      setError(null)
      try {
        const releases = await getRecentPopularReleases(24)
        setAlbums(releases)
      } catch (err) {
        setError(err?.message ?? 'Unable to load featured releases.')
      } finally {
        setLoading(false)
      }
    }
    loadFeatured()
  }, [])

  const handleSearch = (value) => {
    if (value?.trim()) {
      navigate(`/search?q=${encodeURIComponent(value)}`)
    }
  }

  const handleAlbumSelect = (id) => {
    navigate(`/album/${id}`, { state: { from: '/discover', query: '' } })
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted">Catalog Explorer</p>
          <h1 className="font-display text-4xl">Dig through the vault</h1>
        </div>

        <SearchBar query="" onSearch={handleSearch} placeholder="Search artists or albums..." enablePredictive />

        <div>
          <p className="mb-4 text-xs uppercase tracking-[0.4em] text-muted">Featured Releases</p>
          <AlbumGrid albums={albums} loading={loading} error={error} onSelect={handleAlbumSelect} />
        </div>
      </div>
    </PageTransition>
  )
}

export default Discover
