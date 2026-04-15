import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import AlbumGrid from '../components/AlbumGrid.jsx'
import Hero from '../components/Hero.jsx'
import PageTransition from '../components/PageTransition.jsx'
import { HomePageSkeleton } from '../components/PageLoadingState.jsx'
import { getHomeSections } from '../services/discogsService.js'

const HOME_SECTION_LIMIT = 24

const Home = () => {
  const navigate = useNavigate()
  const [showAllHappeningAlbums, setShowAllHappeningAlbums] = useState(false)

  const homeSectionsQuery = useQuery({
    queryKey: ['home-sections', HOME_SECTION_LIMIT, HOME_SECTION_LIMIT],
    queryFn: () =>
      getHomeSections({
        happeningLimit: HOME_SECTION_LIMIT,
        recentLimit: HOME_SECTION_LIMIT,
      }),
    staleTime: 1000 * 60 * 5,
  })

  const mostHappeningAlbums = Array.isArray(homeSectionsQuery.data?.mostHappening?.data)
    ? homeSectionsQuery.data.mostHappening.data
    : []
  const recentAlbums = Array.isArray(homeSectionsQuery.data?.recentReleases?.data)
    ? homeSectionsQuery.data.recentReleases.data
    : []
  const requestErrorMessage = homeSectionsQuery.error?.message ?? null
  const happeningError = requestErrorMessage ?? homeSectionsQuery.data?.mostHappening?.error ?? null
  const recentError = requestErrorMessage ?? homeSectionsQuery.data?.recentReleases?.error ?? null

  if (homeSectionsQuery.isLoading && !homeSectionsQuery.data) {
    return (
      <PageTransition>
        <HomePageSkeleton />
      </PageTransition>
    )
  }

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
            loading={false}
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
            loading={false}
            error={recentError}
            onSelect={handleAlbumSelect}
          />
        </section>
      </div>
    </PageTransition>
  )
}

export default Home
