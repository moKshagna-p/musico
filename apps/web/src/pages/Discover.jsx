import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import AlbumGrid from '../components/album/AlbumGrid.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import SearchBar from '../components/search/SearchBar.jsx'
import SectionHeading from '../components/ui/SectionHeading.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { getRecentPopularReleases } from '../services/discogsService.js'
import { recordSearchSignal } from '../services/searchSignalService.js'

const RECENT_RELEASES_LIMIT = 24

const Discover = () => {
  const navigate = useNavigate()
  const { user, isPending } = useAuth()
  const historyScope = user?.id ?? 'guest'
  const enableHistory = !isPending && Boolean(user?.id)

  const recentReleasesQuery = useQuery({
    queryKey: ['featured', 'recent-popular', RECENT_RELEASES_LIMIT],
    queryFn: () => getRecentPopularReleases(RECENT_RELEASES_LIMIT),
    staleTime: 1000 * 60 * 5,
  })

  const albums = Array.isArray(recentReleasesQuery.data) ? recentReleasesQuery.data : []
  const error = recentReleasesQuery.error?.message ?? null

  const handleSearch = (value) => {
    if (value?.trim()) {
      void recordSearchSignal(value)
      navigate(`/search?q=${encodeURIComponent(value)}`)
    }
  }

  const handleAlbumSelect = (id) => {
    navigate(`/album/${id}`, { state: { from: '/discover', query: '' } })
  }

  return (
    <PageTransition>
      <div className="space-y-20">
        <header className="mx-auto max-w-3xl pt-6 text-center tablet:pt-14">
          <h1 className="font-display text-5xl leading-[0.95] text-paper tablet:text-7xl">Dig through the vault</h1>
          <p className="mx-auto mt-5 max-w-md text-muted">Search millions of releases by artist or album.</p>
          <div className="mt-10 text-left">
            <SearchBar
              query=""
              onSearch={handleSearch}
              placeholder="Search artists or albums..."
              enablePredictive
              historyScope={historyScope}
              enableHistory={enableHistory}
            />
          </div>
        </header>

        <section className="space-y-10">
          <SectionHeading title="Recent releases" note="Popular pressings that just landed." />
          <AlbumGrid albums={albums} loading={recentReleasesQuery.isLoading && !recentReleasesQuery.data} error={error} onSelect={handleAlbumSelect} />
        </section>
      </div>
    </PageTransition>
  )
}

export default Discover
