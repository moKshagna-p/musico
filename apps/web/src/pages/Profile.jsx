import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiExternalLink, FiLogOut, FiX } from 'react-icons/fi'
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
  const [showEditModal, setShowEditModal] = useState(false)
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
          if (!data.username) {
            setShowUsernameSetup(true)
          }
        }
      } catch {
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

  const openEditModal = useCallback(() => {
    setEditBio(socialProfile?.bio ?? '')
    setEditIsPublic(socialProfile?.isPublic ?? true)
    setProfileStatus('')
    setShowEditModal(true)
  }, [socialProfile])

  const handleProfileSave = useCallback(async () => {
    if (savingProfile) return
    setSavingProfile(true)
    setProfileStatus('')
    try {
      const updated = await updateMyProfile({
        bio: editBio.trim(),
        isPublic: editIsPublic,
      })
      setSocialProfile((prev) => ({ ...prev, ...updated }))
      setProfileStatus('Saved.')
      setTimeout(() => setShowEditModal(false), 600)
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
          Loading profile...
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

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-md rounded-2xl border border-outline bg-panel p-8">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 p-1 text-muted transition-colors hover:text-white"
              aria-label="Close"
            >
              <FiX className="h-5 w-5" />
            </button>

            <h2 className="font-display text-2xl font-bold">Edit Profile</h2>
            <p className="mt-1 text-sm text-muted">Update your bio and privacy settings.</p>

            <div className="mt-6 space-y-5">
              {socialProfile?.username && (
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] text-muted">Username</label>
                  <p className="mt-1.5 text-sm text-white/80">@{socialProfile.username}</p>
                </div>
              )}

              <div>
                <label htmlFor="edit-bio" className="block text-xs uppercase tracking-[0.2em] text-muted">
                  Bio
                </label>
                <textarea
                  id="edit-bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value.slice(0, 160))}
                  placeholder="Tell people about yourself..."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-lg border border-outline bg-canvas/60 p-3 text-sm text-white placeholder:text-muted/50 focus:border-white/30 focus:outline-none"
                />
                <p className="mt-1 text-right text-xs tabular-nums text-muted/60">{editBio.length}/160</p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-outline/60 bg-canvas/30 px-4 py-3">
                <div>
                  <p className="text-sm text-white">Public Profile</p>
                  <p className="text-xs text-muted">{editIsPublic ? 'Anyone can see your profile' : 'Only you can see your profile'}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editIsPublic}
                  onClick={() => setEditIsPublic((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                    editIsPublic ? 'bg-white' : 'bg-outline'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full transition-transform duration-200 ${
                      editIsPublic ? 'translate-x-5 bg-canvas' : 'translate-x-1 bg-muted'
                    }`}
                  />
                </button>
              </div>

              {profileStatus && (
                <p className={`text-xs ${profileStatus === 'Saved.' ? 'text-green-400' : 'text-red-400'}`} aria-live="polite">
                  {profileStatus}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleProfileSave}
                  disabled={savingProfile}
                  className="flex-1 rounded-full bg-white py-3 text-xs font-semibold uppercase tracking-[0.2em] text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-full border border-outline px-5 py-3 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl py-4 tablet:py-8">
        <header className="py-8 text-center tablet:py-14">
          {/* Avatar circle */}
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-outline/60 text-3xl font-bold text-muted">
            {(user.name ?? user.email)?.charAt(0)?.toUpperCase() ?? '?'}
          </div>

          <h1 className="mx-auto max-w-4xl break-words font-display text-4xl font-bold leading-tight tablet:text-7xl">
            {user.name || user.email}
          </h1>
          <p className="mt-3 break-all text-sm text-muted tablet:mt-4 tablet:text-lg">{user.email}</p>

          {socialProfile?.username && (
            <p className="mt-2 text-sm text-muted">@{socialProfile.username}</p>
          )}

          {socialProfile?.bio && (
            <p className="mx-auto mt-3 max-w-md text-sm text-white/70">{socialProfile.bio}</p>
          )}

          {/* Follower / Following counts */}
          {socialProfile && (
            <div className="mt-5 flex items-center justify-center gap-8 text-sm">
              <div>
                <span className="font-semibold text-white">{socialProfile.followerCount ?? 0}</span>
                <span className="ml-1 text-muted">followers</span>
              </div>
              <div>
                <span className="font-semibold text-white">{socialProfile.followingCount ?? 0}</span>
                <span className="ml-1 text-muted">following</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.24em] text-muted transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas tablet:tracking-[0.3em]"
            >
              <FiEdit2 aria-hidden="true" />
              Edit Profile
            </button>

            {socialProfile?.username && (
              <Link
                to={`/u/${socialProfile.username}`}
                className="inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.24em] text-muted transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas tablet:tracking-[0.3em]"
              >
                <FiExternalLink aria-hidden="true" />
                Public Profile
              </Link>
            )}

            {!socialProfile?.username && !profileLoading && (
              <button
                type="button"
                onClick={() => setShowUsernameSetup(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-canvas transition-opacity hover:opacity-90"
              >
                Set Username
              </button>
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
