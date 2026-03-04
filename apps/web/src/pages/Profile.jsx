import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiExternalLink, FiLogOut } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import Stats from '../components/Stats.jsx'
import TopGenres from '../components/TopGenres.jsx'
import UsernameSetup from '../components/UsernameSetup.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useLists } from '../hooks/useLists.js'
import { useRatings } from '../hooks/useRatings.js'
import { getReleaseDetails } from '../services/discogsService.js'
import { fetchMyProfile, updateMyProfile } from '../services/socialService.js'

const Profile = () => {
  const navigate = useNavigate()
  const { user, isPending, signOutCurrentUser } = useAuth()
  const { lists } = useLists()
  const { ratings, loadingRatings } = useRatings()
  const [ratedAlbums, setRatedAlbums] = useState([])

  // Social profile state
  const [socialProfile, setSocialProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [showUsernameSetup, setShowUsernameSetup] = useState(false)
  const [editBio, setEditBio] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileStatus, setProfileStatus] = useState('')

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth')
    }
  }, [isPending, user, navigate])

  // Load social profile
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    const loadProfile = async () => {
      setProfileLoading(true)
      try {
        const data = await fetchMyProfile()
        if (!cancelled && data) {
          setSocialProfile(data)
          setEditBio(data.bio ?? '')
          setEditIsPublic(data.isPublic ?? true)
          // Show username setup if no username set
          if (!data.username) {
            setShowUsernameSetup(true)
          }
        }
      } catch {
        // Profile may not exist yet, prompt for username
        if (!cancelled) {
          setShowUsernameSetup(true)
        }
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }

    void loadProfile()
    return () => { cancelled = true }
  }, [user?.id])

  const handleProfileSave = useCallback(async () => {
    if (savingProfile) return
    setSavingProfile(true)
    setProfileStatus('')
    try {
      const updated = await updateMyProfile({
        bio: editBio.trim(),
        isPublic: editIsPublic,
      })
      setSocialProfile(updated)
      setProfileStatus('Profile updated.')
    } catch (err) {
      setProfileStatus(err?.message ?? 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }, [editBio, editIsPublic, savingProfile])

  const handleUsernameComplete = useCallback(async () => {
    setShowUsernameSetup(false)
    try {
      const data = await fetchMyProfile()
      if (data) {
        setSocialProfile(data)
        setEditBio(data.bio ?? '')
        setEditIsPublic(data.isPublic ?? true)
      }
    } catch {
      // ignore
    }
  }, [])

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
      {showUsernameSetup && (
        <UsernameSetup
          onComplete={handleUsernameComplete}
          onSkip={() => setShowUsernameSetup(false)}
        />
      )}

      <div className="mx-auto w-full max-w-6xl py-4 tablet:py-8">
        <header className="py-8 text-center tablet:py-14">
          <h1 className="mx-auto max-w-4xl break-words font-display text-4xl font-bold leading-tight tablet:text-7xl">
            {user.name || user.email}
          </h1>
          <p className="mt-3 break-all text-sm text-muted tablet:mt-4 tablet:text-lg">{user.email}</p>

          {socialProfile?.username && (
            <p className="mt-2 text-sm text-muted">
              @{socialProfile.username}
            </p>
          )}

          <div className="mt-6 flex items-center justify-center gap-3">
            {socialProfile?.username && (
              <Link
                to={`/u/${socialProfile.username}`}
                className="inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.24em] text-muted transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas tablet:tracking-[0.3em]"
              >
                <FiExternalLink aria-hidden="true" />
                View Public Profile
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.24em] text-muted transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas tablet:px-5 tablet:tracking-[0.3em]"
            >
              <FiLogOut aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </header>

        <main className="mt-10 tablet:mt-16">
          {/* Profile Settings */}
          <section className="mb-16 rounded-2xl border border-outline/60 bg-panel/30 p-6 tablet:p-8">
            <h2 className="mb-6 font-display text-2xl font-bold">Profile Settings</h2>

            {!socialProfile?.username && !profileLoading && (
              <div className="mb-6 rounded-xl border border-outline bg-canvas/50 p-4">
                <p className="text-sm text-muted">You haven't set a username yet.</p>
                <button
                  type="button"
                  onClick={() => setShowUsernameSetup(true)}
                  className="mt-3 rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-canvas hover:opacity-90"
                >
                  Choose Username
                </button>
              </div>
            )}

            {socialProfile?.username && (
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-[0.2em] text-muted">Username</label>
                <p className="mt-1 text-sm text-white">@{socialProfile.username}</p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="profile-bio" className="block text-xs uppercase tracking-[0.2em] text-muted">
                Bio
              </label>
              <textarea
                id="profile-bio"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value.slice(0, 160))}
                placeholder="Tell people about yourself..."
                rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-outline bg-canvas/50 p-3 text-sm text-white placeholder:text-muted/50 focus:border-white/30 focus:outline-none"
              />
              <p className="mt-1 text-right text-xs tabular-nums text-muted/60">{editBio.length}/160</p>
            </div>

            <div className="mb-6 flex items-center gap-3">
              <label htmlFor="profile-public" className="text-xs uppercase tracking-[0.2em] text-muted">
                Public Profile
              </label>
              <button
                id="profile-public"
                type="button"
                role="switch"
                aria-checked={editIsPublic}
                onClick={() => setEditIsPublic((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-outline transition-colors duration-200 ${
                  editIsPublic ? 'bg-white' : 'bg-canvas'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full transition-transform duration-200 ${
                    editIsPublic ? 'translate-x-5 bg-canvas' : 'translate-x-1 bg-muted'
                  }`}
                />
              </button>
              <span className="text-xs text-muted">{editIsPublic ? 'Visible to everyone' : 'Only visible to you'}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={savingProfile}
                className="rounded-full bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
              {profileStatus && (
                <p className="text-xs text-muted" aria-live="polite">{profileStatus}</p>
              )}
            </div>
          </section>

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
