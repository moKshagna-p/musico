import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { FiLogOut } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useLists } from '../hooks/useLists.js'
import { useRatings } from '../hooks/useRatings.js'
import { getReleaseDetails } from '../services/discogsService.js'

const Profile = () => {
  const navigate = useNavigate()
  const { user, isPending, signOutCurrentUser } = useAuth()
  const { ratings } = useRatings()
  const [ratedAlbums, setRatedAlbums] = useState([])
  const [loadingAlbums, setLoadingAlbums] = useState(true)

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
      setLoadingAlbums(true)
      const albums = await Promise.all(
        ratedItems.map(async (item) => {
          const details = await getReleaseDetails(item.albumId)
          return { ...item, ...details }
        }),
      )
      setRatedAlbums(albums)
      setLoadingAlbums(false)
    }

    if (ratedItems.length > 0) {
      fetchRatedAlbums()
    } else {
      setLoadingAlbums(false)
    }
  }, [ratedItems])

  const handleSignOut = async () => {
    await signOutCurrentUser()
    navigate('/auth')
  }

  if (isPending || !user) {
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
      <div className="container mx-auto px-4 py-8">
        <header className="relative py-16 text-center">
          <h1 className="font-serif text-8xl font-bold">{user.name || user.email}</h1>
          <p className="mt-4 text-lg text-muted">{user.email}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="absolute top-8 right-8 inline-flex items-center gap-2 rounded-full border border-outline px-5 py-2 text-xs uppercase tracking-[0.3em] text-muted transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <FiLogOut aria-hidden="true" />
            Sign Out
          </button>
        </header>

        <main className="mt-16">
          {loadingAlbums ? (
            <div className="text-center text-muted">Loading rated albums...</div>
          ) : (
            <div className="columns-1 gap-4 space-y-4 md:columns-2 lg:columns-3">
              {ratedAlbums.map((album) => (
                <motion.div
                  key={album.albumId}
                  className="relative overflow-hidden rounded-lg"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                >
                  <img src={album.cover} alt={album.name} className="w-full" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-300 hover:opacity-100">
                    <div className="flex h-full items-center justify-center text-center">
                      <div>
                        <h2 className="font-bold text-white">{album.name}</h2>
                        <p className="text-white">{album.artist}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </PageTransition>
  )
}

export default Profile

