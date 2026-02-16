import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AlbumGrid from '../components/AlbumGrid.jsx'
import Hero from '../components/Hero.jsx'
import PageTransition from '../components/PageTransition.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { searchReleases, getFeaturedReleases } from '../services/discogsService.js'
import { getTopGenresForRecommendations } from '../services/recommendationProfileService.js'

const Home = () => {
  const navigate = useNavigate()
  const { user, isPending } = useAuth()
  const recommendationScope = !isPending && user?.id ? user.id : ''
  const [featuredAlbums, setFeaturedAlbums] = useState([])
  const [recommendedAlbums, setRecommendedAlbums] = useState([])
  const [showAllTopAlbums, setShowAllTopAlbums] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recommendedLoading, setRecommendedLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadFeatured = async () => {
      setLoading(true)
      setError(null)
      try {
        const releases = await getFeaturedReleases(24)
        setFeaturedAlbums(releases)
      } catch (err) {
        setError(err?.message ?? 'Unable to load featured releases.')
      } finally {
        setLoading(false)
      }
    }

    loadFeatured()
  }, [])

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!recommendationScope) {
        setRecommendedAlbums([])
        return
      }

      const topGenres = getTopGenresForRecommendations(recommendationScope, 3)
      if (!topGenres.length) {
        setRecommendedAlbums([])
        return
      }

      setRecommendedLoading(true)
      try {
        const allResults = []

        for (const genre of topGenres) {
          const results = await searchReleases(genre)
          allResults.push(...results.slice(0, 4))
        }

        const uniqueResults = Array.from(
          new Map(allResults.map((item) => [item.id, item])).values(),
        )

        setRecommendedAlbums(uniqueResults.slice(0, 6))
      } catch (err) {
        console.warn('Unable to load recommendations', err)
        setRecommendedAlbums([])
      } finally {
        setRecommendedLoading(false)
      }
    }
    loadRecommendations()
  }, [recommendationScope])

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
            <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-muted">Based On Albums You Opened</p>
                <h2 className="font-display text-2xl tablet:text-3xl">For You</h2>
              </div>
              <Link
                to="/discover"
                className="text-xs uppercase tracking-[0.35em] text-muted transition hover:text-white tablet:tracking-[0.5em]"
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
          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted">Global Listening Pulse</p>
              <h2 className="font-display text-2xl tablet:text-3xl">Top Albums Right Now</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAllTopAlbums((prev) => !prev)}
              className="w-fit text-xs uppercase tracking-[0.35em] text-muted transition hover:text-white tablet:tracking-[0.5em]"
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
