import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import FollowButton from '../components/user/FollowButton.jsx'
import ProfileCover from '../components/user/ProfileCover.jsx'
import PageTransition from '../components/ui/PageTransition.jsx'
import { ProfilePageSkeleton } from '../components/ui/PageLoadingState.jsx'
import SectionHeading from '../components/ui/SectionHeading.jsx'
import AlbumTile from '../components/album/AlbumTile.jsx'
import BackButton from '../components/ui/BackButton.jsx'
import ListCard from '../components/list/ListCard.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { fetchUserProfile } from '../services/socialService.js'

const UserProfile = () => {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  // Cached, so coming back from an album or list shows the profile at once instead of its skeleton.
  const profileQuery = useQuery({
    queryKey: ['user-profile', username],
    queryFn: () => fetchUserProfile(username),
    enabled: Boolean(username),
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
  const profile = profileQuery.data
  const error = profileQuery.error ? (profileQuery.error.message ?? 'User not found.') : null

  const ratedAlbumDetails = profile?.recentRatings?.map((item) => ({
    ...item,
    name: item?.albumName || 'Untitled',
    cover: item?.albumCover || '',
    artists: Array.isArray(item?.albumArtists) ? item.albumArtists : [],
  })) ?? []
  
  if (profileQuery.isLoading) {
    return (
      <PageTransition>
        <ProfilePageSkeleton />
      </PageTransition>
    )
  }

  if (error || !profile) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl py-16 text-center">
          <h1 className="font-display text-5xl text-paper">User not found</h1>
          <p className="mt-3 text-muted">{error ?? "This user doesn't exist."}</p>
          <button
            type="button"
            onClick={() => navigate('/feed')}
            className="mt-6 rounded-full border border-white/15 px-5 py-2 text-sm text-paper transition-colors hover:bg-white/[0.06]"
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
        <BackButton onClick={() => navigate(-1)} />
        <ProfileCover src={profile.cover} />

        <header className="flex flex-col gap-8 pb-10 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-end">
            {profile.image ? (
              <img src={profile.image} alt="" className="motion-safe:animate-[avatarPop_0.7s_cubic-bezier(0.16,1,0.3,1)_both] h-24 w-24 shrink-0 rounded-full object-cover ring-1 ring-white/10 tablet:h-32 tablet:w-32" />
            ) : (
              <div className="vinyl relative flex h-24 w-24 shrink-0 motion-safe:animate-[avatarPop_0.7s_cubic-bezier(0.16,1,0.3,1)_both] items-center justify-center tablet:h-32 tablet:w-32">
                <span className="relative flex h-[40%] w-[40%] items-center justify-center rounded-full bg-paper font-display text-2xl text-black">
                  {profile.name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="break-words font-display text-5xl leading-[0.95] text-paper tablet:text-7xl">
                {profile.name}
              </h1>
              <p className="mt-3 text-sm text-muted">@{profile.username}</p>
              {profile.bio && <p className="mt-3 max-w-md text-paper/75">{profile.bio}</p>}
              <div className="mt-4 flex items-center gap-5 text-sm text-muted">
                <span><span className="font-medium text-paper">{profile.followerCount}</span> followers</span>
                <span><span className="font-medium text-paper">{profile.followingCount}</span> following</span>
              </div>
            </div>
          </div>

          {!isOwnProfile && user && (
            <FollowButton username={profile.username} initialFollowing={profile.isFollowing} />
          )}
        </header>

        {profile.isPrivate ? (
          <div className="mx-auto mt-14 max-w-md rounded-3xl border border-dashed border-white/10 px-8 py-12 text-center">
            <h2 className="font-display text-3xl text-paper">This account is private</h2>
            <p className="mt-3 text-sm text-muted/70">You can still follow this user, but their music activity is hidden.</p>
          </div>
        ) : (
          <section className="mt-14 space-y-24">
            {ratedAlbumDetails.length > 0 && (
              <div>
                <div className="mb-10"><SectionHeading title="Recently Rated" /></div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4 tablet:gap-x-8 tablet:gap-y-14">
                  {ratedAlbumDetails.map((album) => (
                    <AlbumTile
                      key={album.albumId}
                      to={`/album/${album.albumId}`}
                      cover={album.cover}
                      name={album.name}
                      artist={album.artist ?? album.artists?.[0]}
                      rating={Number(album.rating ?? 0)}
                    />
                  ))}
                </div>
              </div>
            )}

            {profile.lists?.length > 0 && (
              <div>
                <div className="mb-10"><SectionHeading title="Lists" /></div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {profile.lists.map((list) => (
                    <ListCard key={list.id} list={list} />
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
