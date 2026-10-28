import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiEdit2, FiLogOut, FiUpload, FiX } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'

import PageTransition from '../components/ui/PageTransition.jsx'
import { ProfilePageSkeleton, UserListLoadingState } from '../components/ui/PageLoadingState.jsx'
import SectionHeading from '../components/ui/SectionHeading.jsx'
import Stats from '../components/user/Stats.jsx'
import TopGenres from '../components/user/TopGenres.jsx'
import ListCard from '../components/list/ListCard.jsx'
import AlbumSlotMachine from '../components/album/AlbumSlotMachine.jsx'
import CoverImage from '../components/ui/CoverImage.jsx'
import UsernameSetup from '../components/user/UsernameSetup.jsx'
import ProfileCover from '../components/user/ProfileCover.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useDashboard } from '../hooks/useDashboard.js'
import { fetchMyFollowers, fetchMyFollowing, updateMyProfile } from '../services/socialService.js'

const FollowListModal = ({ title, users, loading, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
    <div className="relative mx-4 w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0b0a]/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,1)] p-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 p-1 text-muted transition-colors hover:text-white"
        aria-label="Close"
      >
        <FiX className="h-5 w-5" />
      </button>

      <h2 className="font-display text-3xl text-paper">{title}</h2>
      <div className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <UserListLoadingState />
        ) : users.length ? (
          users.map((person) => (
            <Link
              key={person.id}
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

// Phone photos run several MB; a banner only needs ~1600px across, which keeps uploads well under the 2MB limit.
const toCoverDataUrl = async (file) => {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

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
  const { dashboard, isLoading: dashboardLoading } = useDashboard()

  // Social profile state
  const [socialProfile, setSocialProfile] = useState(null)
  const [showUsernameSetup, setShowUsernameSetup] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editBio, setEditBio] = useState('')
  const [editImage, setEditImage] = useState('')
  const [editCover, setEditCover] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileStatus, setProfileStatus] = useState('')
  const [showFollowersModal, setShowFollowersModal] = useState(false)
  const [showFollowingModal, setShowFollowingModal] = useState(false)
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [followersLoading, setFollowersLoading] = useState(false)
  const [followingLoading, setFollowingLoading] = useState(false)
  const fileInputRef = useRef(null)
  const coverInputRef = useRef(null)

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth')
    }
  }, [isPending, user, navigate])

  // Use batched dashboard data instead of separate API calls
  useEffect(() => {
    if (dashboard) {
      const profile = {
        id: dashboard.profile?.id,
        userId: dashboard.profile?.userId,
        username: dashboard.profile?.username,
        bio: dashboard.profile?.bio,
        name: dashboard.profile?.name,
        image: dashboard.profile?.image,
        cover: dashboard.profile?.cover,
        followerCount: dashboard.profile?.followerCount ?? 0,
        followingCount: dashboard.profile?.followingCount ?? 0,
        recentRatings: dashboard.recentRatings ?? [],
      }
      setSocialProfile(profile)
      setEditBio(profile.bio ?? '')
      setEditImage(profile.image ?? '')
      setEditCover(profile.cover ?? '')
      if (!profile.username) {
        setShowUsernameSetup(true)
      }
    }
  }, [dashboard])

  const openEditModal = useCallback(() => {
    setEditBio(socialProfile?.bio ?? '')
    setEditImage(socialProfile?.image ?? '')
    setEditCover(socialProfile?.cover ?? '')
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
        cover: editCover,
      })
      setSocialProfile((prev) => ({ ...prev, ...updated }))
      setProfileStatus('Saved.')
      setTimeout(() => setShowEditModal(false), 600)
    } catch (err) {
      setProfileStatus(err?.message ?? 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }, [editBio, editImage, editCover, savingProfile])

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

  const handleCoverFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setEditCover(await toCoverDataUrl(file))
      setProfileStatus('')
    } catch {
      setProfileStatus('Unable to read that image.')
    }
  }, [])

  const ratedItems = useMemo(
    () =>
      Object.entries(dashboard?.ratings ?? {})
        .map(([albumId, value]) => ({
          albumId,
          rating: Number(value?.rating ?? 0),
          timestamp: Number(value?.timestamp ?? 0),
        }))
        .filter((entry) => Number.isFinite(entry.rating) && entry.rating > 0)
        .sort((a, b) => b.timestamp - a.timestamp),
    [dashboard?.ratings],
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
              artists: Array.isArray(item?.albumArtists) ? item.albumArtists.filter(Boolean).map(String) : [],
              genres: Array.isArray(item?.genres) ? item.genres.filter(Boolean).map(String) : [],
            }))
            .filter((item) => item.albumId && Number.isFinite(item.rating) && item.rating > 0)
        : [],
    [socialProfile?.recentRatings],
  )

  const recentlyRated = useMemo(
    () => {
      if (recentRatingPreviews.length) return recentRatingPreviews
      return ratedItems.slice(0, 10).map((entry) => ({
        albumId: entry.albumId,
        rating: entry.rating,
        timestamp: entry.timestamp,
        name: 'Recently rated',
        cover: '',
        artists: [],
        genres: [],
      }))
    },
    [ratedItems, recentRatingPreviews],
  )

  const handleSignOut = async () => {
    await signOutCurrentUser()
    navigate('/auth')
  }

  const totalRated = Number(dashboard?.ratingSummary?.totalRated ?? ratedItems.length)
  const averageRating = Number.isFinite(Number(dashboard?.ratingSummary?.averageRating))
    ? Number(dashboard?.ratingSummary?.averageRating)
    : totalRated > 0
      ? ratedItems.reduce((acc, item) => acc + item.rating, 0) / totalRated
      : 0

  const statsSourceAlbums = useMemo(
    () =>
      recentRatingPreviews.map((item) => ({
        ...item,
        name: item.name || 'Recently rated',
        artists: item.artists,
        genres: item.genres,
      })),
    [recentRatingPreviews],
  )

  if (isPending || !user) {
    return (
      <PageTransition>
        <ProfilePageSkeleton showActions />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="relative mx-4 max-h-[90svh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0b0a]/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,1)] p-8">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 p-1 text-muted transition-colors hover:text-white"
              aria-label="Close"
            >
              <FiX className="h-5 w-5" />
            </button>

            <h2 className="font-display text-3xl text-paper">Edit Profile</h2>
            <p className="mt-1 text-sm text-muted">Update your bio, profile picture, and cover.</p>

            <div className="mt-6 space-y-5">
              {socialProfile?.username && (
                <div>
                  <label className="block text-sm text-muted">Username</label>
                  <p className="mt-1.5 text-sm text-white/80">@{socialProfile.username}</p>
                </div>
              )}

              <div>
                <label htmlFor="edit-bio" className="block text-sm text-muted">
                  Bio
                </label>
                <textarea
                  id="edit-bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value.slice(0, 160))}
                  placeholder="Tell people about yourself..."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white placeholder:text-muted/50 focus:border-white/30 focus:outline-none"
                />
                <p className="mt-1 text-right text-xs text-muted/60">{editBio.length}/160</p>
              </div>

              <div>
                <label className="block text-sm text-muted">Profile Picture</label>
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
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-white/30 hover:text-paper"
                    >
                      <FiUpload aria-hidden="true" />
                      Upload From Device
                    </button>
                    {editImage && (
                      <button
                        type="button"
                        onClick={() => setEditImage('')}
                        className="rounded-full border border-white/12 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-white/30 hover:text-paper"
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

              <div>
                <label className="block text-sm text-muted">Cover</label>
                <div className="mt-2 overflow-hidden rounded-lg border border-outline/60 bg-canvas/30">
                  {editCover ? (
                    <img src={editCover} alt="" className="aspect-[3/1] w-full object-cover" />
                  ) : (
                    <div className="aspect-[3/1] w-full bg-white/[0.03]" />
                  )}
                  <div className="flex flex-wrap gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-white/30 hover:text-paper"
                    >
                      <FiUpload aria-hidden="true" />
                      Upload Cover
                    </button>
                    {editCover && (
                      <button
                        type="button"
                        onClick={() => setEditCover('')}
                        className="rounded-full border border-white/12 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-white/30 hover:text-paper"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileChange}
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
                  className="flex-1 rounded-full bg-paper py-3 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-full border border-white/12 px-5 py-3 text-sm text-paper/80 transition-colors hover:border-white/30 hover:text-paper"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl py-4 tablet:py-8">
        <ProfileCover src={socialProfile?.cover} />
        <header className="flex flex-col gap-8 pb-10 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-end">
            {socialProfile?.image ? (
              <img
                src={socialProfile.image}
                alt=""
                className="h-24 w-24 shrink-0 rounded-full object-cover ring-1 ring-white/10 tablet:h-32 tablet:w-32"
              />
            ) : (
              <div className="vinyl relative flex h-24 w-24 shrink-0 items-center justify-center tablet:h-32 tablet:w-32">
                <span className="relative flex h-[40%] w-[40%] items-center justify-center rounded-full bg-paper font-display text-2xl text-black">
                  {(user.name ?? user.email)?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}

            <div className="min-w-0">
              <h1 className="break-words font-display text-5xl leading-[0.95] text-paper tablet:text-7xl">
                {user.name || user.email}
              </h1>
              <p className="mt-3 break-all text-sm text-muted">
                {socialProfile?.username ? `@${socialProfile.username}` : user.email}
              </p>
              {socialProfile?.bio && (
                <p className="mt-3 max-w-md text-paper/75">{socialProfile.bio}</p>
              )}

              {socialProfile && (
                <div className="mt-4 flex items-center gap-5 text-sm">
                  <button type="button" onClick={openFollowers} className="text-muted transition-colors hover:text-paper">
                    <span className="font-medium text-paper">{socialProfile.followerCount ?? 0}</span> followers
                  </button>
                  <button type="button" onClick={openFollowing} className="text-muted transition-colors hover:text-paper">
                    <span className="font-medium text-paper">{socialProfile.followingCount ?? 0}</span> following
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!socialProfile?.username && !dashboardLoading && (
              <button
                type="button"
                onClick={() => setShowUsernameSetup(true)}
                className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
              >
                Set Username
              </button>
            )}
            <button type="button" onClick={openEditModal} className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-white/30 hover:text-paper">
              <FiEdit2 aria-hidden="true" />
              Edit Profile
            </button>
            <button type="button" onClick={handleSignOut} className="inline-flex items-center gap-2 rounded-full border border-white/12 px-4 py-2 text-sm text-paper/80 transition-colors hover:border-white/30 hover:text-paper">
              <FiLogOut aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </header>

        <main className="mt-10 tablet:mt-16">
          <Stats ratedAlbums={statsSourceAlbums} totalRated={totalRated} averageRating={averageRating} />
          <TopGenres ratedAlbums={statsSourceAlbums} />

          <section>
            <div className="mb-8">
              <SectionHeading
                title="Recently Rated"
                note="The last records you scored."
                action={(
                  <Link to="/profile/history" className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/[0.06] hover:text-paper">
                    View Full History
                  </Link>
                )}
              />
            </div>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {!recentlyRated.length && (
                <p className="w-full rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-muted">
                  Nothing rated yet. <Link to="/discover" className="text-paper underline underline-offset-4">Find an album</Link> and give it some stars.
                </p>
              )}
              {recentlyRated.map((album) => (
                <Link
                  to={`/album/${album.albumId}`}
                  key={album.albumId}
                  className="group w-[180px] flex-none snap-start tablet:w-[200px]"
                >
                  <div className="relative overflow-hidden rounded-[4px] shadow-sleeve transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1">
                    <CoverImage
                      src={album.cover}
                      alt={album.name || 'Album cover'}
                      className="block aspect-square w-full object-cover"
                    />
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-xs text-paper backdrop-blur">
                      {album.rating.toFixed(1)}
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-1 font-display text-lg leading-tight text-paper">{album.name || 'Untitled album'}</h3>
                  <p className="flex justify-between gap-2 text-sm text-muted">
                    <span className="truncate">{album.artists?.[0] ?? 'Unknown artist'}</span>
                    <span className="shrink-0 text-xs">{formatReviewedAt(album.timestamp)}</span>
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {!dashboardLoading && <AlbumSlotMachine key={user.id} userId={user.id} lists={dashboard?.lists ?? []} />}

          <section className="mt-24">
            <div className="mb-10">
              <SectionHeading title="Your Collections" note="Lists you've built, newest first." />
            </div>

            <div className="grid grid-cols-1 gap-8 tablet:grid-cols-2 lg:grid-cols-2">
              {dashboard?.lists?.length ? (
                dashboard.lists.map((list) => (
                  <ListCard key={list.id} list={list} />
                ))
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-muted">
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
