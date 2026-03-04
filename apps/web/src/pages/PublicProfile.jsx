import { useEffect, useMemo, useState } from 'react'
import { FiShare2 } from 'react-icons/fi'
import { FaStar } from 'react-icons/fa'
import { Link, useNavigate, useParams } from 'react-router-dom'

import FollowButton from '../components/FollowButton.jsx'
import PageTransition from '../components/PageTransition.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { fetchPublicProfile } from '../services/socialService.js'
import { getReleaseDetails } from '../services/discogsService.js'

const PublicProfile = () => {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [ratedAlbumDetails, setRatedAlbumDetails] = useState([])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPublicProfile(username)
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

  // Fetch album details for recent ratings
  useEffect(() => {
    if (!profile?.recentRatings?.length) {
      setRatedAlbumDetails([])
      return
    }

    let cancelled = false
    const fetchDetails = async () => {
      const results = await Promise.allSettled(
        profile.recentRatings.slice(0, 12).map(async (item) => {
          const details = await getReleaseDetails(item.albumId)
          return { ...item, ...details }
        }),
      )
      if (!cancelled) {
        setRatedAlbumDetails(
          results.filter((r) => r.status === 'fulfilled').map((r) => r.value),
        )
      }
    }

    void fetchDetails()
    return () => {
      cancelled = true
    }
  }, [profile?.recentRatings])

  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl py-16 text-center text-muted">Loading profile...</div>
      </PageTransition>
    )
  }

  if (error || !profile) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl py-16 text-center">
          <h1 className="font-display text-3xl font-bold">User not found</h1>
          <p className="mt-3 text-muted">{error ?? "This profile doesn't exist or is private."}</p>
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

  const isOwnProfile = profile.isOwnProfile

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-6xl py-4 tablet:py-8">
        {/* Header */}
        <header className="py-8 text-center tablet:py-14">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-outline/60 text-3xl font-bold text-muted">
            {profile.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>

          <h1 className="mx-auto max-w-4xl break-words font-display text-4xl font-bold leading-tight tablet:text-7xl">
            {profile.name}
          </h1>

          <p className="mt-2 text-lg text-muted">@{profile.username}</p>

          {profile.bio && (
            <p className="mx-auto mt-4 max-w-md text-sm text-white/70">{profile.bio}</p>
          )}

          {/* Stats row */}
          <div className="mt-6 flex items-center justify-center gap-8 text-sm">
            <div>
              <span className="font-semibold text-white">{profile.followerCount}</span>
              <span className="ml-1 text-muted">followers</span>
            </div>
            <div>
              <span className="font-semibold text-white">{profile.followingCount}</span>
              <span className="ml-1 text-muted">following</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex items-center justify-center gap-3">
            {!isOwnProfile && user && (
              <FollowButton
                username={profile.username}
                initialFollowing={profile.isFollowing}
              />
            )}

            {isOwnProfile && (
              <Link
                to="/profile"
                className="rounded-full border border-outline px-5 py-2 text-xs uppercase tracking-[0.2em] text-muted hover:text-white"
              >
                Edit Profile
              </Link>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-white"
            >
              <FiShare2 aria-hidden="true" />
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>

          {!isOwnProfile && !user && (
            <p className="mt-4 text-xs text-muted">
              <Link to="/auth" className="text-white hover:underline">
                Sign in
              </Link>{' '}
              to follow this user.
            </p>
          )}
        </header>

        {/* Stats cards */}
        <section className="grid grid-cols-2 gap-4 tablet:grid-cols-4">
          <StatCard label="Albums Rated" value={profile.stats.totalRated} />
          <StatCard label="Avg Rating" value={profile.stats.averageRating.toFixed(1)} />
          <StatCard label="Reviews" value={profile.stats.totalReviews} />
          <StatCard label="Lists" value={profile.stats.totalLists} />
        </section>

        {/* Recently Rated */}
        {ratedAlbumDetails.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-8 text-center font-display text-3xl font-bold tablet:text-4xl">
              Recently Rated
            </h2>
            <div className="grid grid-cols-2 gap-4 tablet:grid-cols-3 laptop:grid-cols-4">
              {ratedAlbumDetails.map((album) => (
                <Link to={`/album/${album.albumId}`} key={album.albumId}>
                  <div className="group relative overflow-hidden rounded-lg">
                    <img
                      src={album.cover}
                      alt={album.name}
                      className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <h3 className="px-2 font-bold text-white">{album.name}</h3>
                        <p className="text-sm text-white/80">{album.artists?.[0] ?? ''}</p>
                        <div className="mt-2 flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <FaStar
                              key={i}
                              className={`h-3 w-3 ${i < album.rating ? 'text-white' : 'text-white/30'}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {profile.recentReviews?.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-8 text-center font-display text-3xl font-bold tablet:text-4xl">
              Recent Reviews
            </h2>
            <div className="space-y-4">
              {profile.recentReviews.map((review, index) => (
                <div
                  key={`${review.albumId}-${index}`}
                  className="flex gap-4 rounded-xl border border-outline/60 bg-panel/30 p-4"
                >
                  {review.albumCover && (
                    <Link to={`/album/${review.albumId}`} className="shrink-0">
                      <img
                        src={review.albumCover}
                        alt={review.albumName}
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    </Link>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/album/${review.albumId}`}
                      className="text-sm font-semibold text-white hover:underline"
                    >
                      {review.albumName || 'Unknown Album'}
                    </Link>
                    {review.albumArtists?.length > 0 && (
                      <span className="ml-2 text-sm text-muted">
                        {review.albumArtists[0]}
                      </span>
                    )}
                    <p className="mt-1 text-sm text-white/70">{review.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Lists */}
        {profile.lists?.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-8 text-center font-display text-3xl font-bold tablet:text-4xl">
              Lists
            </h2>
            <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2">
              {profile.lists.map((list) => (
                <Link
                  to={`/lists/${list.id}`}
                  key={list.id}
                  className="group rounded-lg border border-outline p-4 transition-colors hover:border-white/20"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-bold">{list.name}</h3>
                    <span className="text-xs text-muted">{list.albumCount} albums</span>
                  </div>
                  {list.albums?.length > 0 && (
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
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageTransition>
  )
}

const StatCard = ({ label, value }) => (
  <div className="rounded-xl border border-outline/60 bg-panel/30 p-5 text-center">
    <p className="text-2xl font-semibold tabular-nums text-white">{value}</p>
    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
  </div>
)

export default PublicProfile
