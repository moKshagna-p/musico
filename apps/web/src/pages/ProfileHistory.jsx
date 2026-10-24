import { useEffect, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import AlbumTile from '../components/album/AlbumTile.jsx'
import { ALBUM_GRID_CLASS } from '../components/album/AlbumGrid.jsx'
import LoadingSkeleton from '../components/ui/LoadingSkeleton.jsx'
import BackButton from '../components/ui/BackButton.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { fetchMyRatingsHistory } from '../services/profileDataService.js'

const HISTORY_PAGE_SIZE = 36

const formatReviewedAt = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

const normalizeHistoryEntry = (item) => ({
  albumId: String(item?.albumId ?? '').trim(),
  rating: Number(item?.rating ?? 0),
  timestamp: Number(item?.timestamp ?? 0),
  name: String(item?.albumName ?? '').trim() || 'Untitled album',
  cover: String(item?.albumCover ?? '').trim(),
  artists: Array.isArray(item?.albumArtists) ? item.albumArtists.filter(Boolean).map(String) : [],
})

const ProfileHistory = () => {
  const navigate = useNavigate()
  const { user, isPending } = useAuth()

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth', { replace: true })
    }
  }, [isPending, navigate, user])

  const historyQuery = useInfiniteQuery({
    queryKey: ['profile-history', user?.id],
    queryFn: ({ pageParam }) =>
      fetchMyRatingsHistory({
        limit: HISTORY_PAGE_SIZE,
        cursor: pageParam,
      }),
    enabled: Boolean(user?.id),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })

  const sortedHistory = useMemo(() => {
    const seen = new Set()
    const entries = []

    for (const rawItem of historyQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []) {
      const normalized = normalizeHistoryEntry(rawItem)
      if (!normalized.albumId || !Number.isFinite(normalized.rating) || normalized.rating <= 0) continue
      if (seen.has(normalized.albumId)) continue

      seen.add(normalized.albumId)
      entries.push(normalized)
    }

    return entries.sort((a, b) => Number(b.timestamp ?? 0) - Number(a.timestamp ?? 0))
  }, [historyQuery.data])

  if (isPending || !user) {
    return null
  }

  return (
    <PageTransition>
      <section className="space-y-8">
        <BackButton onClick={() => navigate('/profile')} label="Back to Profile" />

        <header className="border-b border-white/[0.07] pb-10">
          <h1 className="font-display text-5xl leading-[0.95] text-paper tablet:text-7xl">All Rated Albums</h1>
          <p className="mt-4 text-muted">Every record you&rsquo;ve scored, newest first.</p>
        </header>

        {historyQuery.isError ? (
          <p className="rounded-2xl border border-white/[0.07] px-4 py-4 text-sm text-muted">
            {historyQuery.error?.message ?? 'Unable to load your listening history right now.'}
          </p>
        ) : null}

        <section className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4 tablet:gap-x-8 tablet:gap-y-14">
          {sortedHistory.map((album) => (
            <AlbumTile
              key={album.albumId}
              to={`/album/${album.albumId}`}
              cover={album.cover}
              name={album.name}
              artist={album.artists?.[0]}
              rating={album.rating}
              meta={formatReviewedAt(album.timestamp)}
              headingLevel="h2"
            />
          ))}
        </section>

        {!historyQuery.isLoading && !sortedHistory.length && !historyQuery.isError ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-muted">
            No ratings yet.
          </div>
        ) : null}

        {historyQuery.isLoading ? (
          <div className={ALBUM_GRID_CLASS} aria-busy="true" aria-label="Loading rated albums">
            <LoadingSkeleton count={8} />
          </div>
        ) : null}

        {historyQuery.hasNextPage ? (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={historyQuery.isFetchingNextPage}
              onClick={() => historyQuery.fetchNextPage()}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm text-paper transition hover:border-white/35 hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-60"
            >
              {historyQuery.isFetchingNextPage ? 'Loading' : 'Load More'}
            </button>
          </div>
        ) : null}
      </section>
    </PageTransition>
  )
}

export default ProfileHistory
