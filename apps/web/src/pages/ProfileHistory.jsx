import { useEffect, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { FiArrowLeft, FiClock } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'

import CoverImage from '../components/ui/CoverImage.jsx'
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
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted transition-colors hover:text-white"
        >
          <FiArrowLeft aria-hidden="true" /> Back to Profile
        </button>

        <header className="rounded-[2rem] border border-outline/70 bg-[radial-gradient(120%_130%_at_0%_0%,rgba(198,170,126,0.14),rgba(198,170,126,0.02)_38%,rgba(0,0,0,0)_70%),linear-gradient(170deg,rgba(8,8,8,0.98),rgba(6,6,6,0.95))] p-6 tablet:p-10">
          <p className="text-xs uppercase tracking-[0.35em] text-muted">Listening History</p>
          <h1 className="mt-2 font-display text-3xl leading-tight tablet:text-5xl">All Rated Albums</h1>
          <p className="mt-3 text-sm text-white/70">A complete record of your ratings, newest to oldest.</p>
        </header>

        {historyQuery.isError ? (
          <p className="rounded-2xl border border-outline/60 bg-panel/35 px-4 py-4 text-sm text-muted">
            {historyQuery.error?.message ?? 'Unable to load your listening history right now.'}
          </p>
        ) : null}

        <section className="grid gap-5 tablet:grid-cols-2 laptop:grid-cols-3">
          {sortedHistory.map((album) => (
            <Link
              key={album.albumId}
              to={`/album/${album.albumId}`}
              className="group block overflow-hidden rounded-3xl border border-outline/70 bg-panel/55 transition duration-200 hover:-translate-y-1 hover:border-white/25"
            >
              <div className="relative overflow-hidden bg-black">
                <CoverImage
                  src={album.cover}
                  alt={album.name}
                  className="block aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
                  {album.rating.toFixed(1)} / 5
                </div>
              </div>

              <div className="relative z-10 -mt-px space-y-2 bg-panel px-4 py-4">
                <div>
                  <h2 className="line-clamp-1 text-base font-semibold text-white">{album.name}</h2>
                  <p className="line-clamp-1 text-sm text-muted">{album.artists?.[0] ?? 'Unknown artist'}</p>
                </div>
                <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted/80">
                  <FiClock aria-hidden="true" /> {formatReviewedAt(album.timestamp)}
                </p>
              </div>
            </Link>
          ))}
        </section>

        {!historyQuery.isLoading && !sortedHistory.length && !historyQuery.isError ? (
          <div className="rounded-2xl border border-dashed border-outline/60 bg-panel/20 px-6 py-10 text-center text-xs uppercase tracking-[0.24em] text-muted/80">
            No ratings yet.
          </div>
        ) : null}

        {historyQuery.isLoading ? (
          <div className="grid gap-5 tablet:grid-cols-2 laptop:grid-cols-3" aria-busy="true" aria-label="Loading rated albums">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-4 rounded-3xl border border-outline/60 bg-panel/45 p-4 motion-safe:animate-pulse">
                <div className="aspect-square rounded-2xl bg-white/[0.06]" />
                <div className="h-5 w-3/4 rounded-full bg-outline/65" />
                <div className="h-4 w-1/2 rounded-full bg-outline/50" />
              </div>
            ))}
          </div>
        ) : null}

        {historyQuery.hasNextPage ? (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={historyQuery.isFetchingNextPage}
              onClick={() => historyQuery.fetchNextPage()}
              className="inline-flex items-center gap-2 rounded-full border border-outline px-5 py-2 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-white disabled:cursor-wait disabled:opacity-60"
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
