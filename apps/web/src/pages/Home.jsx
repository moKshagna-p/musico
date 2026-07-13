import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import AlbumGrid from '../components/album/AlbumGrid.jsx'
import Hero from '../components/ui/Hero.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import { HomePageSkeleton } from '../components/ui/PageLoadingState.jsx'
import { homeSectionsQueryOptions } from '../queries/homeSections.js'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js'

// Initial load: 12 albums per section (reduced from 24)
const HOME_SECTION_INITIAL_LIMIT = 12
// Load 12 more albums when user scrolls to the bottom
const HOME_SECTION_PAGE_SIZE = 12

const Home = () => {
  const navigate = useNavigate()
  const [showAllHappeningAlbums, setShowAllHappeningAlbums] = useState(false)
  const [displayRecentCount, setDisplayRecentCount] = useState(HOME_SECTION_INITIAL_LIMIT)

  const homeSectionsQuery = useQuery(homeSectionsQueryOptions)

  const mostHappeningAlbums = Array.isArray(homeSectionsQuery.data?.mostHappening?.data)
    ? homeSectionsQuery.data.mostHappening.data
    : []
  const recentAlbums = Array.isArray(homeSectionsQuery.data?.recentReleases?.data)
    ? homeSectionsQuery.data.recentReleases.data
    : []
  const requestErrorMessage = homeSectionsQuery.error?.message ?? null
  const happeningError = requestErrorMessage ?? homeSectionsQuery.data?.mostHappening?.error ?? null
  const recentError = requestErrorMessage ?? homeSectionsQuery.data?.recentReleases?.error ?? null
  const visibleMostHappeningAlbums = showAllHappeningAlbums ? mostHappeningAlbums : mostHappeningAlbums.slice(0, 6)
  const visibleRecentAlbums = recentAlbums.slice(0, displayRecentCount)
  const hasMoreRecent = displayRecentCount < recentAlbums.length

  // Lazy load handler: fetches more recent albums when user scrolls to bottom
  const handleLoadMoreRecent = useCallback(async () => {
    if (!hasMoreRecent) return
    setDisplayRecentCount((prev) => Math.min(prev + HOME_SECTION_PAGE_SIZE, recentAlbums.length))
  }, [hasMoreRecent, recentAlbums.length])

  const { observerTarget: recentLoadMoreTarget, isLoading: isLoadingMore } = useInfiniteScroll(
    handleLoadMoreRecent,
    { enabled: hasMoreRecent, rootMargin: '200px' }
  )

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
            albums={visibleRecentAlbums}
            loading={false}
            error={recentError}
            onSelect={handleAlbumSelect}
          />
          
          {/* Lazy load trigger: appears when user scrolls near the bottom */}
          {hasMoreRecent && (
            <div ref={recentLoadMoreTarget} className="flex justify-center py-8">
              <div className="text-sm text-muted">
                {isLoadingMore ? 'Loading more albums...' : 'Scroll for more'}
              </div>
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  )
}

export default Home
