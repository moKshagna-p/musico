import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AlbumGrid from '../components/AlbumGrid.jsx'
import Hero from '../components/Hero.jsx'
import PageTransition from '../components/PageTransition.jsx'
import { getFeaturedReleases, getRecentPopularReleases } from '../services/discogsService.js'

const Home = () => {
  const navigate = useNavigate()
  const [mostHappeningAlbums, setMostHappeningAlbums] = useState([])
  const [recentAlbums, setRecentAlbums] = useState([])
  const [showAllHappeningAlbums, setShowAllHappeningAlbums] = useState(false)
  const [happeningLoading, setHappeningLoading] = useState(true)
  const [recentLoading, setRecentLoading] = useState(true)
  const [happeningError, setHappeningError] = useState(null)
  const [recentError, setRecentError] = useState(null)

  useEffect(() => {
    const loadHomeSections = async () => {
      setHappeningLoading(true)
      setRecentLoading(true)
      setHappeningError(null)
      setRecentError(null)

      const [mostHappeningResult, recentReleasesResult] = await Promise.allSettled([
          getFeaturedReleases(24),
          getRecentPopularReleases(24),
      ])

      if (mostHappeningResult.status === 'fulfilled') {
        setMostHappeningAlbums(mostHappeningResult.value)
      } else {
        setHappeningError(mostHappeningResult.reason?.message ?? 'Unable to load most happening albums.')
      }

      if (recentReleasesResult.status === 'fulfilled') {
        setRecentAlbums(recentReleasesResult.value)
      } else {
        setRecentError(recentReleasesResult.reason?.message ?? 'Unable to load recent releases.')
      }

      setHappeningLoading(false)
      setRecentLoading(false)
    }

    loadHomeSections()
  }, [])

  const handleAlbumSelect = (id) => {
    navigate(`/album/${id}`, { state: { from: '/', query: '' } })
  }

  const visibleMostHappeningAlbums = showAllHappeningAlbums ? mostHappeningAlbums : mostHappeningAlbums.slice(0, 6)

  return (
    <PageTransition>
      <Hero />

      <div className="mt-12 space-y-10">
        <section className="space-y-6">
          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted">Weekly Chart Pulse</p>
              <h2 className="font-display text-2xl tablet:text-3xl">Most Happening Right Now</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAllHappeningAlbums((prev) => !prev)}
              className="w-fit text-xs uppercase tracking-[0.35em] text-muted transition hover:text-white tablet:tracking-[0.5em]"
            >
              {showAllHappeningAlbums ? 'Show less' : 'See all'}
            </button>
          </div>
          <AlbumGrid
            albums={visibleMostHappeningAlbums}
            loading={happeningLoading}
            error={happeningError}
            onSelect={handleAlbumSelect}
          />
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted">Weekly Fresh Pull</p>
              <h2 className="font-display text-2xl tablet:text-3xl">Recent Releases</h2>
            </div>
          </div>
          <AlbumGrid
            albums={recentAlbums}
            loading={recentLoading}
            error={recentError}
            onSelect={handleAlbumSelect}
          />
        </section>
      </div>
    </PageTransition>
  )
}

export default Home
