import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useWindowDimensions, View } from 'react-native'

import { fetchUserProfile } from '@/lib/api'
import { useAuth } from '@/lib/state'
import { AlbumTile, ListCard } from '@/ui/album'
import { Display, Muted, Pill, SectionHeading, Skeleton } from '@/ui/kit'
import { FollowButton } from '@/ui/people'
import { ProfileHeader } from '@/ui/profile'
import { Screen } from '@/ui/Screen'
import { GUTTER } from '@/ui/theme'

export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const { width } = useWindowDimensions()
  const tile = (width - GUTTER * 2 - 20) / 2
  const { user, isPending } = useAuth()
  // Cached, so coming back from an album or list shows the profile at once instead of its skeleton.
  const profile = useQuery({
    queryKey: ['user-profile', username?.toLowerCase(), user?.id ?? null],
    queryFn: () => fetchUserProfile(username),
    enabled: !isPending && Boolean(username),
    retry: false,
  })

  if (isPending || profile.isLoading) {
    return (
      <Screen footer={false}>
        <View style={{ paddingTop: 16 }}>
          <Skeleton style={{ width: 96, height: 96 }} />
          <Skeleton style={{ marginTop: 24, height: 44, width: '70%', borderRadius: 12 }} />
          <Skeleton style={{ marginTop: 14, height: 14, width: 100 }} />
        </View>
      </Screen>
    )
  }
  if (profile.error || !profile.data) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', paddingVertical: 64 }}>
          <Display size={48} style={{ textAlign: 'center' }}>User not found</Display>
          <Muted style={{ marginTop: 12 }}>{profile.error?.message ?? "This user doesn't exist."}</Muted>
          <Pill label="Back to Feed" onPress={() => router.navigate('/feed')} style={{ marginTop: 24 }} />
        </View>
      </Screen>
    )
  }

  const data = profile.data
  const rated = (data.recentRatings ?? []) as any[]
  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <ProfileHeader person={data} actions={!data.isOwnProfile && user ? <FollowButton username={data.username} initialFollowing={data.isFollowing} /> : undefined} />
      {data.isPrivate ? (
        <View style={{ marginTop: 56, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 28, paddingVertical: 48 }}>
          <Display size={30} style={{ textAlign: 'center' }}>This account is private</Display>
          <Muted style={{ marginTop: 12, textAlign: 'center', color: 'rgba(142,139,133,0.7)' }}>You can still follow this user, but their music activity is hidden.</Muted>
        </View>
      ) : (
        <View style={{ marginTop: 56, gap: 96 }}>
          {rated.length ? (
            <View>
              <SectionHeading title="Recently Rated" />
              <View style={{ marginTop: 40, flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 40 }}>
                {rated.map((item, index) => (
                  <AlbumTile
                    key={item.albumId}
                    index={index}
                    width={tile}
                    rating={Number(item.rating ?? 0)}
                    album={{ id: item.albumId, name: item.albumName || 'Untitled', cover: item.albumCover, artists: item.albumArtists ?? [] }}
                  />
                ))}
              </View>
            </View>
          ) : null}
          {data.lists?.length ? (
            <View>
              <SectionHeading title="Lists" />
              <View style={{ marginTop: 40, gap: 24 }}>
                {data.lists.map((list: any, index: number) => <ListCard key={list.id} list={list} index={index} />)}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  )
}
