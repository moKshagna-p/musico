import { useEffect, useState } from 'react'
import { FiShare2 } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import { fetchPublicList } from '../services/socialService.js'

const PublicList = () => {
  const { listId } = useParams()
  const navigate = useNavigate()
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPublicList(listId)
        if (!cancelled) setList(data)
      } catch (err) {
        if (!cancelled) setError(err?.message ?? 'List not found.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [listId])

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl py-16 text-center text-muted">Loading list...</div>
      </PageTransition>
    )
  }

  if (error || !list) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl py-16 text-center">
          <h1 className="font-display text-3xl font-bold">List not found</h1>
          <p className="mt-3 text-muted">{error ?? "This list doesn't exist or is private."}</p>
          <button
            type="button"
            onClick={() => navigate('/discover')}
            className="mt-6 rounded-full border border-outline px-5 py-2 text-xs uppercase tracking-[0.2em] text-muted hover:text-white"
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
        <header className="py-8 text-center tablet:py-14">
          <p className="text-xs uppercase tracking-[0.52em] text-muted">List</p>
          <h1 className="mt-3 font-display text-3xl font-bold tablet:text-5xl">{list.name}</h1>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
            <span>by</span>
            <span className="font-semibold text-white">{list.owner?.name ?? 'Unknown'}</span>
            <span className="text-muted/60">|</span>
            <span>{list.albumCount} albums</span>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-white"
          >
            <FiShare2 aria-hidden="true" />
            {copied ? 'Copied' : 'Share List'}
          </button>
        </header>

        {list.albums?.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 tablet:grid-cols-3 laptop:grid-cols-4">
            {list.albums.map((album) => (
              <Link to={`/album/${album.id}`} key={album.id}>
                <div className="group relative overflow-hidden rounded-lg">
                  <img
                    src={album.cover}
                    alt={album.name}
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex h-full flex-col items-center justify-center text-center p-3">
                      <h3 className="font-bold text-white text-sm">{album.name}</h3>
                      <p className="text-xs text-white/80 mt-1">
                        {Array.isArray(album.artists) ? album.artists[0] : ''}
                      </p>
                      {album.releaseYear && (
                        <p className="text-xs text-white/60 mt-0.5">{album.releaseYear}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-muted">This list is empty.</p>
        )}
      </div>
    </PageTransition>
  )
}

export default PublicList
