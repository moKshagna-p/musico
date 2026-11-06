import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Share, useWindowDimensions, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { fetchPublicList } from '@/lib/api'
import { AlbumCardSkeleton, AlbumTile } from '@/ui/album'
import { Display, EmptyNote, Muted, Pill } from '@/ui/kit'
import { Screen } from '@/ui/Screen'
import { colors, easeOut, GUTTER } from '@/ui/theme'

export default function PublicList() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { width } = useWindowDimensions()
  const tile = (width - GUTTER * 2 - 20) / 2
  const list = useQuery({ queryKey: ['public-list', id], queryFn: () => fetchPublicList(id), enabled: Boolean(id), retry: false })

  if (list.error || (!list.isLoading && !list.data)) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', paddingVertical: 64 }}>
          <Display size={48}>List not found</Display>
          <Muted style={{ marginTop: 12, textAlign: 'center' }}>It may be private, or it was deleted.</Muted>
          <Pill label="Go back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} style={{ marginTop: 24 }} />
        </View>
      </Screen>
    )
  }
  const { name = '', owner, albums = [] } = list.data ?? {}

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(500).easing(easeOut)} style={{ paddingTop: 16 }}>
        <Muted>
          {list.isLoading ? 'Loading list' : `${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`}
          {owner?.username ? ' · by ' : ''}
          {owner?.username ? <Muted style={{ color: colors.paper }} onPress={() => router.push({ pathname: '/user/[username]', params: { username: owner.username } })}>@{owner.username}</Muted> : null}
        </Muted>
        <Display size={48} style={{ marginTop: 12 }}>{name || ' '}</Display>
        {/* The web's public link, so a list can be sent to someone without the app. */}
        {name ? <Pill label="Share list" icon="share" onPress={() => Share.share({ message: `${name} on Musico: https://musico-web.vercel.app/lists/${id}` })} style={{ marginTop: 24, alignSelf: 'flex-start' }} /> : null}
      </Animated.View>
      {list.isLoading ? (
        <View style={{ marginTop: 40, flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 40 }}>
          {Array.from({ length: 4 }, (_, index) => <AlbumCardSkeleton key={index} width={tile} />)}
        </View>
      ) : albums.length ? (
        <View style={{ marginTop: 40, flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 40 }}>
          {albums.map((album: any, index: number) => <AlbumTile key={album.id} album={album} width={tile} index={index} />)}
        </View>
      ) : (
        <View style={{ marginTop: 40 }}><EmptyNote>This list is empty for now.</EmptyNote></View>
      )}
    </Screen>
  )
}
