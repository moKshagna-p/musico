import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiEdit2, FiLogOut, FiUpload, FiX } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import Stats from '../components/Stats.jsx'
import TopGenres from '../components/TopGenres.jsx'
import ListCard from '../components/ListCard.jsx'
import UsernameSetup from '../components/UsernameSetup.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useLists } from '../hooks/useLists.js'
import { useRatings } from '../hooks/useRatings.js'
import { getReleaseDetails } from '../services/discogsService.js'
import { fetchMyFollowers, fetchMyFollowing, fetchMyProfile, updateMyProfile } from '../services/socialService.js'

const FollowListModal = ({ title, users, loading, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
    <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-outline bg-panel p-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 p-1 text-muted transition-colors hover:text-white"
        aria-label="Close"
      >
        <FiX className="h-5 w-5" />
      </button>

      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <div className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : users.length ? (
          users.map((person) => (
            <Link
              key={person.userId}
              to={person.username ? `/profile/${person.username}` : '#'}
              onClick={person.username ? onClose : undefined}
              className="flex items-center gap-3 rounded-xl border border-outline/60 bg-canvas/30 px-4 py-3 transition hover:border-outline hover:bg-canvas/40"
            >
              {person.image ? (
                <img src={person.image} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-outline/60 text-sm font-semibold text-muted">
                  {person.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{person.name}</p>
                {person.username && <p className="truncate text-xs text-muted">@{person.username}</p>}
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted">No users here yet.</p>
        )}
      </div>
    </div>
  </div>
)

const formatReviewedAt = (timestamp) => {
  if (!timestamp) return ''

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

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
  const [editImage, setEditImage] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileStatus, setProfileStatus] = useState('')
  const [showFollowersModal, setShowFollowersModal] = useState(false)
  const [showFollowingModal, setShowFollowingModal] = useState(false)
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [followersLoading, setFollowersLoading] = useState(false)
  const [followingLoading, setFollowingLoading] = useState(false)
  const fileInputRef = useRef(null)

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
          setEditImage(data.image ?? '')
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
    setEditImage(socialProfile?.image ?? '')
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
        image: editImage.trim(),
      })
      setSocialProfile((prev) => ({ ...prev, ...updated }))
      setProfileStatus('Saved.')
      setTimeout(() => setShowEditModal(false), 600)
    } catch (err) {
      setProfileStatus(err?.message ?? 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }, [editBio, editImage, savingProfile])

  const openFollowers = useCallback(async () => {
    setShowFollowersModal(true)
    setFollowersLoading(true)
    try {
      setFollowers(await fetchMyFollowers())
    } finally {
      setFollowersLoading(false)
    }
  }, [])

  const openFollowing = useCallback(async () => {
    setShowFollowingModal(true)
    setFollowingLoading(true)
    try {
      setFollowing(await fetchMyFollowing())
    } finally {
      setFollowingLoading(false)
    }
  }, [])

  const handleUsernameComplete = useCallback(async () => {
    setShowUsernameSetup(false)
    try {
      const data = await fetchMyProfile()
      if (data) {
        setSocialProfile(data)
        setEditBio(data.bio ?? '')
        setEditImage(data.image ?? '')
      }
    } catch {
      // ignore
    }
  }, [])

  const handleImageFileChange = useCallback((event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setProfileStatus('Please choose an image file.')
      event.target.value = ''
      return
    }

    const maxFileSizeBytes = 1024 * 1024 * 2
    if (file.size > maxFileSizeBytes) {
      setProfileStatus('Image must be smaller than 2MB.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditImage(reader.result)
        setProfileStatus('')
      }
    }
    reader.onerror = () => {
      setProfileStatus('Unable to read that image.')
    }
    reader.readAsDataURL(file)
    event.target.value = ''
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

  const recentRatingPreviews = useMemo(
    () =>
      Array.isArray(socialProfile?.recentRatings)
        ? socialProfile.recentRatings
            .map((item) => ({
              albumId: String(item?.albumId ?? '').trim(),
              rating: Number(item?.rating ?? 0),
              timestamp: Number(item?.timestamp ?? 0),
              name: String(item?.albumName ?? '').trim(),
              cover: String(item?.albumCover ?? '').trim(),
            }))
            .filter((item) => item.albumId && Number.isFinite(item.rating) && item.rating > 0)
        : [],
    [socialProfile?.recentRatings],
  )

  useEffect(() => {
    const fetchRatedAlbums = async () => {
      if (ratedItems.length === 0) {
        setRatedAlbums([])
        return
      }
      
      const topItems = [...ratedItems]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 6)

      const albums = await Promise.allSettled(
        topItems.map(async (item) => {
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
    () => {
      if (recentRatingPreviews.length) return recentRatingPreviews
      return [...ratedAlbums].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
    },
    [ratedAlbums, recentRatingPreviews],
  )

  const handleSignOut = async () => {
    await signOutCurrentUser()
    navigate('/auth')
  }

  const totalRated = ratedItems.length
  const averageRating = totalRated > 0
    ? ratedItems.reduce((acc, item) => acc + item.rating, 0) / totalRated
    : 0

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

      {showFollowersModal && (
        <FollowListModal
          title="Followers"
          users={followers}
          loading={followersLoading}
          onClose={() => setShowFollowersModal(false)}
        />
      )}

      {showFollowingModal && (
        <FollowListModal
          title="Following"
          users={following}
          loading={followingLoading}
          onClose={() => setShowFollowingModal(false)}
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
            <p className="mt-1 text-sm text-muted">Update your bio and profile picture.</p>

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

              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-muted">Profile Picture</label>
                <div className="mt-2 flex items-center gap-4 rounded-lg border border-outline/60 bg-canvas/30 p-4">
                  {editImage ? (
                    <img src={editImage} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-white/10" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-outline/60 text-lg font-semibold text-muted">
                      {(user.name ?? user.email)?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-white"
                    >
                      <FiUpload aria-hidden="true" />
                      Upload From Device
                    </button>
                    {editImage && (
                      <button
                        type="button"
                        onClick={() => setEditImage('')}
                        className="rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-white"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
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
          {socialProfile?.image ? (
            <img
              src={socialProfile.image}
              alt=""
              className="mx-auto mb-5 h-20 w-20 rounded-full object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-outline/60 text-3xl font-bold text-muted">
              {(user.name ?? user.email)?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          )}

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
              <button type="button" onClick={openFollowers} className="transition hover:text-white">
                <span className="font-semibold text-white">{socialProfile.followerCount ?? 0}</span>
                <span className="ml-1 text-muted">followers</span>
              </button>
              <button type="button" onClick={openFollowing} className="transition hover:text-white">
                <span className="font-semibold text-white">{socialProfile.followingCount ?? 0}</span>
                <span className="ml-1 text-muted">following</span>
              </button>
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
          <Stats ratedAlbums={ratedAlbums} totalRated={totalRated} averageRating={averageRating} />
          <TopGenres ratedAlbums={ratedAlbums} />

          <section>
            <div className="mb-10 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.45em] text-muted">Listening History</p>
              <h2 className="mt-2 font-display text-3xl font-bold tablet:text-4xl">Recently Rated</h2>
            </div>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recentlyRated.map((album) => (
                <Link
                  to={`/album/${album.albumId}`}
                  key={album.albumId}
                  className="group min-w-[220px] max-w-[220px] flex-none snap-start transition-transform duration-300 hover:-translate-y-1.5"
                >
                  <div className="overflow-hidden rounded-2xl border border-outline/70 bg-panel/70 transition-colors duration-200 group-hover:border-white/20">
                    <div className="relative">
                      <img
                        src={album.cover}
                        alt={album.name || 'Album cover'}
                        className="block aspect-square w-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                      <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/80">
                        {album.rating.toFixed(1)} / 5
                      </div>
                    </div>
                      <div className="space-y-2 px-4 py-4">
                        <div>
                        <h3 className="line-clamp-1 text-base font-semibold text-white">{album.name || 'Untitled album'}</h3>
                        <p className="line-clamp-1 text-sm text-muted">
                          {album.artist ?? album.artists?.[0] ?? 'Recently rated'}
                        </p>
                        </div>
                      <p className="text-right text-[11px] uppercase tracking-[0.2em] text-muted/80">
                        {formatReviewedAt(album.timestamp)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-20">
            <div className="mb-12 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.45em] text-muted">Personal Library</p>
              <h2 className="mt-2 font-display text-3xl font-bold tablet:text-5xl">Your Collections</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-8 tablet:grid-cols-2 lg:grid-cols-2">
              {lists.length ? (
                lists.map((list) => (
                  <ListCard key={list.id} list={list} />
                ))
              ) : (
                <div className="col-span-full rounded-[2.5rem] border border-dashed border-outline/60 bg-panel/20 p-12 text-center text-muted/60 uppercase tracking-widest text-[10px] font-bold">
                  No lists created yet.
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </PageTransition>
  )
}

export default Profile
