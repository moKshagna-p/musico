import { useEffect, useMemo, useState } from 'react'
import { FiLogOut } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import Stats from '../components/Stats.jsx'
import TopGenres from '../components/TopGenres.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useLists } from '../hooks/useLists.js'
import { useRatings } from '../hooks/useRatings.js'
import { getReleaseDetails } from '../services/discogsService.js'

const Profile = () => {
  const navigate = useNavigate()
  const { user, isPending, signOutCurrentUser } = useAuth()
  const { lists } = useLists()
  const { ratings, loadingRatings } = useRatings()
  const [ratedAlbums, setRatedAlbums] = useState([])

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth')
    }
  }, [isPending, user, navigate])

  const ratedItems = useMemo(
    () =>
      Object.entries(ratings ?? {})
        .map(([albumId, value]) => ({
          albumId,
          rating: Number(value?.rating ?? 0),
          timestamp: Number(value?.timestamp ?? 0),
        }))
        .filter((entry) => Number.isFinite(entry.rating) && entry.rating > 0)
        .sort((a, b) => b.timestamp - a.timestamp),
    [ratings],
  )

  useEffect(() => {
    const fetchRatedAlbums = async () => {
      if (ratedItems.length === 0) {
        setRatedAlbums([])
        return
      }
      const albums = await Promise.allSettled(
        ratedItems.map(async (item) => {
          const details = await getReleaseDetails(item.albumId)
          return { ...item, ...details }
        }),
      )
      setRatedAlbums(
        albums
          .filter((entry) => entry.status === 'fulfilled')
          .map((entry) => entry.value),
      )
    }

    void fetchRatedAlbums()
  }, [ratedItems])

  const recentlyRated = useMemo(
    () => [...ratedAlbums].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10),
    [ratedAlbums],
  )

  const handleSignOut = async () => {
    await signOutCurrentUser()
    navigate('/auth')
  }

  if (isPending || !user || loadingRatings) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl rounded-3xl border border-outline bg-panel p-8 text-center text-muted">
          Loading profile…
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-6xl py-4 tablet:py-8">
        <header className="py-8 text-center tablet:py-14">
          <h1 className="mx-auto max-w-4xl break-words font-display text-4xl font-bold leading-tight tablet:text-7xl">
            {user.name || user.email}
          </h1>
          <p className="mt-3 break-all text-sm text-muted tablet:mt-4 tablet:text-lg">{user.email}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.24em] text-muted transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas tablet:mt-8 tablet:px-5 tablet:tracking-[0.3em]"
          >
            <FiLogOut aria-hidden="true" />
            Sign Out
          </button>
        </header>

        <main className="mt-10 tablet:mt-16">
          <Stats ratedAlbums={ratedAlbums} />
          <TopGenres ratedAlbums={ratedAlbums} />

          <section>
            <h2 className="mb-8 text-center font-display text-3xl font-bold tablet:text-4xl">Recently Rated</h2>
            <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
              {recentlyRated.map((album) => (
                <Link to={`/album/${album.albumId}`} key={album.albumId}>
                  <div className="group relative overflow-hidden rounded-lg">
                    <img src={album.cover} alt={album.name} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <div className="flex h-full items-center justify-center text-center">
                        <div>
                          <h2 className="font-bold text-white">{album.name}</h2>
                          <p className="text-white">{album.artist ?? album.artists?.[0] ?? 'Unknown artist'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="mb-8 text-center font-display text-3xl font-bold tablet:text-4xl">Lists</h2>
            <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2">
              {lists.map((list) => (
                <div key={list.id} className="rounded-lg border border-outline p-4">
                  <h3 className="text-lg font-bold">{list.name}</h3>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {list.albums.slice(0, 6).map((album) => (
                      <img
                        key={album.id}
                        src={album.cover}
                        alt={album.name}
                        className="aspect-square w-full rounded-md object-cover"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </PageTransition>
  )
}

export default Profile
