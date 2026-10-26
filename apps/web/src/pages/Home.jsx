import { useQuery } from '@tanstack/react-query'
import { FaStar } from 'react-icons/fa'
import { FiArrowUpRight } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'

import AlbumRow from '../components/album/AlbumRow.jsx'
import Billboard, { WIDE_GUTTER } from '../components/ui/Billboard.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import VinylSleeve from '../components/ui/VinylSleeve.jsx'
import { homeSectionsQueryOptions } from '../queries/homeSections.js'

const Home = () => {
  const navigate = useNavigate()
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
  const loading = homeSectionsQuery.isLoading && !homeSectionsQuery.data
  const topAlbum = mostHappeningAlbums[0]

  const handleAlbumSelect = (id) => {
    navigate(`/album/${id}`, { state: { from: '/', query: '' } })
  }

  return (
    <PageTransition bleed>
      <Billboard
        artist={topAlbum?.artists?.[0]}
        cover={topAlbum?.cover}
        gutter={WIDE_GUTTER}
        className={topAlbum || loading ? undefined : 'min-h-[50svh]'}
      >
        {topAlbum ? (
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:gap-10">
            {/* Phones skip the sleeve: it would cover the artist photo, and the same cover leads the chart row below. */}
            <div className="hidden w-56 shrink-0 pr-16 md:block tablet:w-72 tablet:pr-24">
              <VinylSleeve src={topAlbum.cover} alt={topAlbum.name} out spin loading="eager" />
            </div>
            <div className="min-w-0 max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-medium text-paper/90 backdrop-blur">
                No. 1 on this week&rsquo;s chart
              </p>
              <h1 className="mt-5 text-balance font-display text-5xl leading-[0.92] text-paper tablet:text-7xl">{topAlbum.name}</h1>
              <p className="mt-4 text-lg font-medium text-paper/85 tablet:text-xl">{topAlbum.artists?.join(', ')}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-paper/60">
                {topAlbum.releaseYear ?? ''}
                {topAlbum.communityRating ? (
                  <span className="inline-flex items-center gap-1"><FaStar aria-hidden="true" className="h-3 w-3" /> {Number(topAlbum.communityRating).toFixed(1)}</span>
                ) : null}
              </p>
              <Link
                to={`/album/${topAlbum.id}`}
                state={{ from: '/', query: '' }}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
              >
                Open album <FiArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : !loading ? (
          // The chart failed or came back empty; the rows below explain which.
          <div className="max-w-2xl">
            <h1 className="text-balance font-display text-5xl leading-[0.92] text-paper tablet:text-7xl">Dig through the vault</h1>
            <Link
              to="/discover"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              Discover albums <FiArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div aria-hidden="true" className="max-w-xl space-y-5">
            <div className="h-6 w-44 rounded-full bg-white/[0.06]" />
            <div className="h-16 w-full rounded-2xl bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04] bg-[length:400px_100%] motion-safe:animate-shimmer" />
            <div className="h-5 w-40 rounded-full bg-white/[0.05]" />
            <div className="h-12 w-40 rounded-full bg-white/[0.06]" />
          </div>
        )}
      </Billboard>

      <div className="relative z-10 -mt-6 space-y-10 tablet:space-y-14">
        <AlbumRow
          title="Most Happening Right Now"
          note="This week's chart, ranked."
          albums={mostHappeningAlbums}
          loading={loading}
          error={happeningError}
          onSelect={handleAlbumSelect}
          ranked
        />
        <AlbumRow
          title="Recent Releases"
          note="Fresh pressings from the past few weeks."
          albums={recentAlbums}
          loading={loading}
          error={recentError}
          onSelect={handleAlbumSelect}
        />
      </div>
    </PageTransition>
  )
}

export default Home
