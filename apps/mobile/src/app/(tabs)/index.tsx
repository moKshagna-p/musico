import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getArtistImage, getHomeSections, type Album } from '@/lib/api'
import { useAuth, useMe } from '@/lib/state'
import { AlbumCard, AlbumCardSkeleton, openAlbum } from '@/ui/album'
import { Display, EmptyNote, Muted, PrimaryButton, Press, Skeleton, StarValue, T } from '@/ui/kit'
import { Screen } from '@/ui/Screen'
import { colors, easeOut, fonts, GUTTER, NAV_SPACE } from '@/ui/theme'

const rise = (delay: number) => FadeInDown.delay(delay).duration(500).easing(easeOut).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })
const greeting = () => {
  const hour = new Date().getHours()
  return hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}
const FEATURED = 5
const ROWS_PER_PAGE = 4

// The app's home, built for a phone rather than ported from the web page: a swipeable deck of the chart's top
// records, the rest of the chart as compact rows paged sideways, then a shelf of new releases.
export default function Home() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const home = useQuery({ queryKey: ['home-sections'], queryFn: getHomeSections })
  const loading = home.isLoading
  const error = home.error?.message ?? home.data?.error ?? null
  const chart = home.data?.mostHappening ?? []
  const firstName = user?.name?.split(' ')[0]

  return (
    <Screen bleed refreshing={home.isRefetching} onRefresh={() => void home.refetch()}>
      <Animated.View entering={rise(0)} style={{ paddingTop: insets.top + NAV_SPACE, paddingHorizontal: GUTTER }}>
        <Muted style={{ fontSize: 15 }}>{greeting()}{firstName ? `, ${firstName}` : ''}</Muted>
        <Display size={34} style={{ marginTop: 6 }}>This week in music</Display>
      </Animated.View>

      {error && !chart.length ? (
        <View style={{ padding: GUTTER, paddingTop: 32, gap: 24 }}>
          <EmptyNote dashed={false}>{error}</EmptyNote>
          <PrimaryButton label="Discover albums" icon="arrow-up-right" onPress={() => router.navigate('/discover')} />
        </View>
      ) : (
        <>
          <FeaturedDeck albums={chart.slice(0, FEATURED)} loading={loading} />
          <ChartPages albums={chart.slice(FEATURED)} loading={loading} />
          <Shelf title="New releases" albums={home.data?.recentReleases ?? []} loading={loading} />
        </>
      )}
    </Screen>
  )
}

const SectionTitle = ({ title }: { title: string }) => (
  <T style={{ paddingHorizontal: GUTTER, fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.7 }}>{title}</T>
)

// Full-width cards that snap one at a time, with dots underneath, like a store's featured row.
const FeaturedDeck = ({ albums, loading }: { albums: Album[]; loading: boolean }) => {
  const { width } = useWindowDimensions()
  const card = width - GUTTER * 2
  const gap = 12
  const [page, setPage] = useState(0)
  if (loading) return <Skeleton style={{ marginTop: 24, marginHorizontal: GUTTER, height: card * 1.15, borderRadius: 28 }} />
  if (!albums.length) return null
  return (
    <View style={{ marginTop: 24 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={card + gap}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap }}
        onScroll={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / (card + gap)))}
        scrollEventThrottle={32}
      >
        {albums.map((album, index) => <FeaturedCard key={album.id} album={album} rank={index + 1} width={card} />)}
      </ScrollView>
      <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {albums.map((album, index) => (
          <View key={album.id} style={{ height: 6, width: index === page ? 18 : 6, borderRadius: 3, backgroundColor: index === page ? colors.paper : 'rgba(238,234,227,0.25)' }} />
        ))}
      </View>
    </View>
  )
}

// The artist's photo when there is one (the same lookup the album page uses), the cover otherwise.
const FeaturedCard = ({ album, rank, width }: { album: Album; rank: number; width: number }) => {
  const artist = album.artists?.[0]
  const { data: art } = useQuery({ queryKey: ['artist-image', artist], queryFn: () => getArtistImage(artist!), enabled: Boolean(artist), staleTime: Infinity, retry: false })
  const photo = art?.square?.image ?? art?.image ?? album.cover
  return (
    <Press onPress={() => openAlbum(album)} scaleTo={0.98} style={[styles.featured, { width, height: width * 1.15 }]} accessibilityRole="link" accessibilityLabel={`Open ${album.name}`}>
      <Image source={album.cover} blurRadius={30} style={StyleSheet.absoluteFill} />
      {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: '25%' }} transition={400} /> : null}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']} locations={[0.35, 0.65, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.badge}>
        <T style={{ fontSize: 12, fontFamily: fonts.semibold, color: colors.paper }}>No. {rank} this week</T>
      </View>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Display size={30} numberOfLines={2}>{album.name}</Display>
          <T numberOfLines={1} style={{ marginTop: 6, fontSize: 16, fontFamily: fonts.medium, color: 'rgba(238,234,227,0.85)' }}>{album.artists?.join(', ')}</T>
          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {album.releaseYear ? <T style={{ fontSize: 13, color: 'rgba(238,234,227,0.6)' }}>{album.releaseYear}</T> : null}
            {Number(album.reviewCount) > 0 ? <StarValue value={Number(album.communityRating ?? 0)} color="rgba(238,234,227,0.6)" /> : null}
          </View>
        </View>
        {album.cover ? <Image source={album.cover} style={styles.thumb} /> : null}
      </View>
    </Press>
  )
}

// The rest of the chart as tappable rows, four to a column, paged sideways so the list never runs down the page.
const ChartPages = ({ albums, loading }: { albums: Album[]; loading: boolean }) => {
  const { width } = useWindowDimensions()
  const { ratings } = useMe()
  const column = width - GUTTER * 2 - 28
  const items = loading ? (Array.from({ length: ROWS_PER_PAGE * 2 }) as Album[]) : albums.slice(0, ROWS_PER_PAGE * 4)
  if (!items.length) return null
  const pages = Array.from({ length: Math.ceil(items.length / ROWS_PER_PAGE) }, (_, page) => items.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE))
  return (
    <View style={{ marginTop: 36 }}>
      <SectionTitle title="Also on the chart" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={column + 12} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 12, paddingTop: 12 }}>
        {pages.map((rows, page) => (
          <View key={page} style={{ width: column }}>
            {rows.map((album, row) => {
              const rank = FEATURED + page * ROWS_PER_PAGE + row + 1
              if (loading) return <ChartRowSkeleton key={row} />
              const mine = ratings[String(album.id)]?.rating
              return (
                <Press key={album.id} onPress={() => openAlbum(album)} scaleTo={0.98} style={[styles.row, row < rows.length - 1 && styles.rowLine]} accessibilityRole="link" accessibilityLabel={`Number ${rank}, ${album.name}`}>
                  <Image source={album.cover} style={styles.rowCover} transition={200} />
                  <T style={styles.rank}>{rank}</T>
                  <View style={{ flex: 1 }}>
                    <T numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.3 }}>{album.name}</T>
                    <Muted numberOfLines={1} style={{ marginTop: 2 }}>{album.artists?.join(', ')}</Muted>
                  </View>
                  {mine ? <StarValue value={mine} color={colors.paper} /> : Number(album.reviewCount) > 0 ? <StarValue value={Number(album.communityRating ?? 0)} color={colors.muted} /> : null}
                </Press>
              )
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const ChartRowSkeleton = () => (
  <View style={styles.row}>
    <Skeleton style={styles.rowCover} />
    <View style={{ flex: 1, marginLeft: 16 }}>
      <Skeleton style={{ height: 14, width: '70%' }} />
      <Skeleton style={{ marginTop: 8, height: 12, width: '40%' }} />
    </View>
  </View>
)

// Smaller sleeves than the web's two-up shelf, so the next one peeks in and the row reads as swipeable.
const Shelf = ({ title, albums, loading }: { title: string; albums: Album[]; loading: boolean }) => {
  const { width } = useWindowDimensions()
  const card = Math.round((width - GUTTER * 2) * 0.42)
  const items = loading ? (Array.from({ length: 4 }) as Album[]) : albums
  if (!items.length) return null
  return (
    <View style={{ marginTop: 28 }}>
      <SectionTitle title={title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={card + 14}
        decelerationRate="fast"
        // Top padding leaves room for the record that rises out of each sleeve on press.
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 40, gap: 14 }}
      >
        {items.map((album, index) => (loading ? <AlbumCardSkeleton key={index} width={card} /> : <AlbumCard key={album.id} album={album} width={card} index={index} />))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  featured: { borderRadius: 28, overflow: 'hidden', backgroundColor: colors.panel },
  badge: { position: 'absolute', top: 16, left: 16, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5 },
  thumb: { width: 64, height: 64, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  rowCover: { width: 56, height: 56, borderRadius: 6, backgroundColor: colors.panel },
  rank: { width: 26, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: colors.muted },
})
