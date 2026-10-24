import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiShare2 } from 'react-icons/fi'
import { useNavigate, useParams } from 'react-router-dom'

import AlbumTile from '../components/album/AlbumTile.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import { PublicListPageSkeleton } from '../components/ui/PageLoadingState.jsx'
import { fetchPublicList } from '../services/socialService.js'
import { coverAt } from '../utils/helpers.js'

const PublicList = () => {
  const { listId } = useParams()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const publicListQuery = useQuery({
    queryKey: ['public-list', listId],
    queryFn: () => fetchPublicList(listId),
    enabled: Boolean(listId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const list = publicListQuery.data

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  if (publicListQuery.isLoading) {
    return (
      <PageTransition>
        <PublicListPageSkeleton />
      </PageTransition>
    )
  }

  if (publicListQuery.isError || !list) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl py-16 text-center">
          <h1 className="font-display text-5xl text-paper">List not found</h1>
          <p className="mt-3 text-muted">This list doesn't exist or is private.</p>
          <button
            type="button"
            onClick={() => navigate('/discover')}
            className="mt-6 rounded-full border border-white/15 px-5 py-2 text-sm text-paper transition-colors hover:bg-white/[0.06]"
          >
            Discover Music
          </button>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-6xl py-4 tablet:py-8">
        {list.albums?.[0]?.cover ? (
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 -top-28 -z-10 h-[40rem] w-screen -translate-x-1/2 overflow-hidden">
            <img src={coverAt(list.albums[0].cover, 100)} alt="" className="h-full w-full scale-125 object-cover opacity-25 blur-[110px] saturate-150" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-black" />
          </div>
        ) : null}

        <header className="mb-14 flex flex-col gap-6 border-b border-white/[0.07] pb-10 pt-6 md:flex-row md:items-end md:justify-between tablet:pt-12">
          <div className="min-w-0">
            <p className="text-sm text-muted">A list by {list.owner?.name ?? 'Unknown'}</p>
            <h1 className="mt-3 break-words font-display text-5xl leading-[0.95] text-paper tablet:text-7xl">{list.name}</h1>
            <p className="mt-4 text-sm text-muted">{list.albumCount ?? list.albums?.length ?? 0} albums</p>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/12 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-white/30 hover:text-paper md:self-auto"
          >
            <FiShare2 aria-hidden="true" />
            {copied ? 'Link copied' : 'Share List'}
          </button>
        </header>

        {list.albums?.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4 tablet:gap-x-8 tablet:gap-y-14">
            {list.albums.map((album) => (
              <AlbumTile
                key={album.id}
                to={`/album/${album.id}`}
                cover={album.cover}
                name={album.name}
                artist={Array.isArray(album.artists) ? album.artists[0] : ''}
                meta={album.releaseYear}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-muted">This list is empty.</p>
        )}
      </div>
    </PageTransition>
  )
}

export default PublicList
