import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AlbumGrid from '../components/AlbumGrid.jsx'
import Hero from '../components/Hero.jsx'
import PageTransition from '../components/PageTransition.jsx'
import { searchReleases, getFeaturedReleases } from '../services/discogsService.js'
import { getSearchHistory } from '../services/searchHistoryService.js'

const TOP_ALBUM_REFRESH_MS = 1000 * 60 * 5

const Home = () => {
  const navigate = useNavigate()
  const [featuredAlbums, setFeaturedAlbums] = useState([])
  const [recommendedAlbums, setRecommendedAlbums] = useState([])
  const [showAllTopAlbums, setShowAllTopAlbums] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recommendedLoading, setRecommendedLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadFeatured = async ({ forceRefresh = false, silent = false } = {}) => {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const releases = await getFeaturedReleases(24, { forceRefresh })
        setFeaturedAlbums(releases)
      } catch (err) {
        setError(err?.message ?? 'Unable to load featured releases.')
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    }

    loadFeatured()
    const intervalId = setInterval(() => {
      loadFeatured({ forceRefresh: true, silent: true })
    }, TOP_ALBUM_REFRESH_MS)

    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const loadRecommendations = async () => {
      const history = getSearchHistory()
      if (history.length === 0) return

      setRecommendedLoading(true)
      try {
        // Get recommendations based on most recent searches
        const recentSearches = history.slice(0, 3)
        const allResults = []
        
        for (const query of recentSearches) {
          const results = await searchReleases(query)
          allResults.push(...results.slice(0, 2))
        }
        
        // Remove duplicates
        const uniqueResults = Array.from(
          new Map(allResults.map(item => [item.id, item])).values()
        )
        
        setRecommendedAlbums(uniqueResults.slice(0, 6))
      } catch (err) {
        console.warn('Unable to load recommendations', err)
      } finally {
        setRecommendedLoading(false)
      }
    }
    loadRecommendations()
  }, [])

  const handleAlbumSelect = (id) => {
    navigate(`/album/${id}`, { state: { from: '/', query: '' } })
  }

  const visibleTopAlbums = showAllTopAlbums ? featuredAlbums : featuredAlbums.slice(0, 6)

  return (
    <PageTransition>
      <Hero />

      <div className="mt-12 space-y-10">
        {recommendedAlbums.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-muted">Based On Your Searches</p>
                <h2 className="font-display text-3xl">For You</h2>
              </div>
            <Link
              to="/discover"
              className="text-xs uppercase tracking-[0.5em] text-muted transition hover:text-white"
            >
              Discover more
              </Link>
            </div>
            <AlbumGrid 
              albums={recommendedAlbums} 
              loading={recommendedLoading} 
              onSelect={handleAlbumSelect} 
            />
          </section>
        )}

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted">Global Listening Pulse</p>
              <h2 className="font-display text-3xl">Top Albums Right Now</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAllTopAlbums((prev) => !prev)}
              className="text-xs uppercase tracking-[0.5em] text-muted transition hover:text-white"
            >
              {showAllTopAlbums ? 'Show less' : 'See all'}
            </button>
          </div>
          <AlbumGrid 
            albums={visibleTopAlbums} 
            loading={loading} 
            error={error} 
            onSelect={handleAlbumSelect} 
          />
        </section>
      </div>
    </PageTransition>
  )
}

export default Home
