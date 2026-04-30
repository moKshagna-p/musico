import { useEffect, useState } from 'react'
import { FiArrowLeft } from 'react-icons/fi'
import { Link, useNavigate, useParams } from 'react-router-dom'

import FollowButton from '../components/user/FollowButton.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import { ProfilePageSkeleton } from '../components/ui/PageLoadingState.jsx'
import RatingStars from '../components/ui/RatingStars.jsx'
import CoverImage from '../components/ui/CoverImage.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { fetchUserProfile } from '../services/socialService.js'

const UserProfile = () => {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchUserProfile(username)
        if (!cancelled) setProfile(data)
      } catch (err) {
        if (!cancelled) setError(err?.message ?? 'User not found.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [username])

  const ratedAlbumDetails = profile?.recentRatings?.map((item) => ({
    ...item,
    name: item?.albumName || 'Untitled',
    cover: item?.albumCover || '',
  })) ?? []
  
  // Limit display to 12 items for better performance
  const displayedRatings = ratedAlbumDetails.slice(0, 12)
  const hasMoreRatings = ratedAlbumDetails.length > 12

  if (loading) {
    return (
      <PageTransition>
        <ProfilePageSkeleton withBackButton />
      </PageTransition>
    )
  }

  if (error || !profile) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl py-16 text-center">
          <h1 className="font-display text-3xl font-bold">User Not Found</h1>
          <p className="mt-3 text-muted">{error ?? "This user doesn't exist."}</p>
          <button
            type="button"
            onClick={() => navigate('/feed')}
            className="mt-6 rounded-full border border-outline px-5 py-2 text-xs uppercase tracking-[0.2em] text-muted hover:text-white"
          >
            Back to Feed
          </button>
        </div>
      </PageTransition>
    )
  }

  const isOwnProfile = profile.isOwnProfile

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-6xl py-4 tablet:py-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted hover:text-white"
        >
          <FiArrowLeft /> Back
        </button>

        <header className="py-8 text-center tablet:py-14">
          {profile.image ? (
            <img src={profile.image} alt="" className="mx-auto mb-6 h-20 w-20 rounded-full object-cover ring-1 ring-white/10" />
          ) : (
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-outline/60 text-3xl font-bold text-muted ring-1 ring-white/10">
              {profile.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          )}

          <h1 className="mx-auto max-w-4xl break-words font-display text-4xl font-bold leading-tight tablet:text-7xl">
            {profile.name}
          </h1>
          <p className="mt-2 text-lg text-muted">@{profile.username}</p>

          {profile.bio && <p className="mx-auto mt-4 max-w-md text-sm text-white/70">{profile.bio}</p>}

          <div className="mt-6 flex items-center justify-center gap-8 text-sm">
            <div>
              <span className="font-semibold tabular-nums text-white">{profile.followerCount}</span>
              <span className="ml-1 text-muted">followers</span>
            </div>
            <div>
              <span className="font-semibold tabular-nums text-white">{profile.followingCount}</span>
              <span className="ml-1 text-muted">following</span>
            </div>
          </div>

          {!isOwnProfile && user && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <FollowButton username={profile.username} initialFollowing={profile.isFollowing} />
            </div>
          )}
        </header>

        {profile.isPrivate ? (
          <div className="mx-auto max-w-md rounded-2xl border border-outline/40 bg-panel/30 px-8 py-12 text-center">
            <h2 className="font-display text-xl font-bold">This account is private</h2>
            <p className="mt-3 text-sm text-muted/70">You can still follow this user, but their music activity is hidden.</p>
          </div>
        ) : (
          <section className="space-y-10">
            {ratedAlbumDetails.length > 0 && (
              <div>
                <h2 className="mb-8 text-center font-display text-3xl font-bold tablet:text-4xl">Recently Rated</h2>
                <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
                  {displayedRatings.map((album) => (
                    <Link to={`/album/${album.albumId}`} key={album.albumId}>
                      <div className="group relative overflow-hidden rounded-lg">
                        <CoverImage src={album.cover} alt={album.name} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <div className="flex h-full items-center justify-center text-center">
                            <div>
                              <h3 className="font-bold text-white">{album.name}</h3>
                              <p className="text-white">{album.artist ?? album.artists?.[0] ?? 'Unknown artist'}</p>
                              <div className="mt-2 flex justify-center">
                                <RatingStars value={Number(album.rating ?? 0)} readOnly size="sm" align="left" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                {hasMoreRatings && (
                  <div className="mt-6 text-center">
                    <Link
                      to={`/${profile.username}/history`}
                      className="inline-block rounded-full border border-outline px-6 py-2 text-xs uppercase tracking-[0.2em] text-muted transition hover:text-white hover:border-white"
                    >
                      View All {ratedAlbumDetails.length} Ratings
                    </Link>
                  </div>
                )}
              </div>
            )}

            {profile.lists?.length > 0 && (
              <div>
                <h2 className="mb-8 text-center font-display text-3xl font-bold tablet:text-4xl">Lists</h2>
                <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2">
                  {profile.lists.map((list) => (
                    <Link key={list.id} to={`/lists/${list.id}`} className="rounded-lg border border-outline p-4 transition hover:border-outline/80">
                      <h3 className="text-lg font-bold">{list.name}</h3>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {list.albums.slice(0, 6).map((album) => (
                          <CoverImage key={album.id} src={album.cover} alt={album.name} className="aspect-square w-full rounded-md object-cover" />
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </PageTransition>
  )
}

export default UserProfile
