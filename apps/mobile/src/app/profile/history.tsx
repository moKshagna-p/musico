import { useInfiniteQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useMemo } from 'react'
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { fetchRatingsHistory } from '@/lib/api'
import { useAuth } from '@/lib/state'
import { AlbumCardSkeleton, AlbumTile } from '@/ui/album'
import { Display, EmptyNote, Muted, Pill } from '@/ui/kit'
import { Screen } from '@/ui/Screen'
import { colors, easeOut, GUTTER } from '@/ui/theme'

const longDate = (timestamp: number) => (timestamp ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(timestamp) : '')

// Every record you've scored, newest first (the web's /profile/history).
export default function ListeningHistory() {
  const { width } = useWindowDimensions()
  const tile = (width - GUTTER * 2 - 20) / 2
  const { user, isPending } = useAuth()
  useEffect(() => {
    if (!isPending && !user) router.replace('/auth')
  }, [isPending, user])

  const history = useInfiniteQuery({
    queryKey: ['profile-history', user?.id],
    queryFn: ({ pageParam }) => fetchRatingsHistory(pageParam),
    enabled: Boolean(user?.id),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
    staleTime: 1000 * 60 * 10,
    retry: false,
  })
  const albums = useMemo(() => {
    const seen = new Set<string>()
    return (history.data?.pages.flatMap((page) => page.items) ?? [])
      .map((item) => ({
        albumId: String(item?.albumId ?? ''),
        rating: Number(item?.rating ?? 0),
        timestamp: Number(item?.timestamp ?? 0),
        name: String(item?.albumName ?? '').trim() || 'Untitled album',
        cover: String(item?.albumCover ?? ''),
        artists: Array.isArray(item?.albumArtists) ? item.albumArtists.map(String) : [],
      }))
      .filter((item) => item.albumId && item.rating > 0 && !seen.has(item.albumId) && seen.add(item.albumId))
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [history.data])

  return (
    <Screen onEndReached={() => history.hasNextPage && !history.isFetchingNextPage && history.fetchNextPage()}>
      <Animated.View entering={FadeInDown.duration(500).easing(easeOut)} style={styles.header}>
        <Display size={48}>All Rated Albums</Display>
        <Muted style={{ marginTop: 16, fontSize: 15 }}>Every record you’ve scored, newest first.</Muted>
      </Animated.View>
      {history.isError ? <EmptyNote dashed={false}>{history.error?.message ?? 'Unable to load your listening history right now.'}</EmptyNote> : null}
      <View style={{ marginTop: 32, flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 40 }}>
        {history.isLoading
          ? Array.from({ length: 6 }, (_, index) => <AlbumCardSkeleton key={index} width={tile} />)
          : albums.map((album, index) => (
              <AlbumTile key={album.albumId} index={index % 12} width={tile} rating={album.rating} meta={longDate(album.timestamp)} album={{ id: album.albumId, name: album.name, cover: album.cover, artists: album.artists }} />
            ))}
      </View>
      {!history.isLoading && !albums.length && !history.isError ? <EmptyNote>No ratings yet.</EmptyNote> : null}
      {history.isFetchingNextPage ? <ActivityIndicator color={colors.paper} style={{ marginTop: 32 }} /> : null}
      {history.isFetchNextPageError ? <View style={{ alignItems: 'center', marginTop: 24 }}><Pill label="Load More" onPress={() => history.fetchNextPage()} /></View> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { paddingTop: 16, paddingBottom: 40, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
})
