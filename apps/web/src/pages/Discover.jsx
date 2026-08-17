import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import AlbumGrid from '../components/album/AlbumGrid.jsx'
import { DiscoverPageSkeleton } from '../components/ui/PageLoadingState.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import SearchBar from '../components/search/SearchBar.jsx'
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

  if (recentReleasesQuery.isLoading && !recentReleasesQuery.data) {
    return (
      <PageTransition>
        <DiscoverPageSkeleton />
      </PageTransition>
    )
  }

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
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted">Catalog Explorer</p>
          <h1 className="font-display text-3xl tablet:text-4xl">Dig through the vault</h1>
        </div>

        <SearchBar
          query=""
          onSearch={handleSearch}
          placeholder="Search artists or albums..."
          enablePredictive
          historyScope={historyScope}
          enableHistory={enableHistory}
        />

        <div>
          <p className="mb-4 text-xs uppercase tracking-[0.4em] text-muted">Recent Releases</p>
          <AlbumGrid albums={albums} loading={false} error={error} onSelect={handleAlbumSelect} />
        </div>
      </div>
    </PageTransition>
  )
}

export default Discover
