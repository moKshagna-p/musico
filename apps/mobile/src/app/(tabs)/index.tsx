import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getArtistImage, getHomeSections, type Album } from '@/lib/api'
import { useMe } from '@/lib/state'
import { AlbumCard, AlbumCardSkeleton, openAlbum } from '@/ui/album'
import { HeroVideo } from '@/ui/HeroVideo'
import { Display, EmptyNote, Muted, PrimaryButton, Press, Skeleton, StarValue, T } from '@/ui/kit'
import { Screen } from '@/ui/Screen'
import { colors, fonts, GUTTER, NAV_SPACE } from '@/ui/theme'

const FEATURED = 5
const CHART_END = 20
const ROWS_PER_PAGE = 4
const ADVANCE_MS = 6000

// The app's home, built for a phone rather than ported from the web page: the chart's top records as a full-bleed
// deck that turns itself, the rest of the top 20 as compact rows paged sideways, then a shelf of new releases.
export default function Home() {
  const insets = useSafeAreaInsets()
  const home = useQuery({ queryKey: ['home-sections'], queryFn: getHomeSections })
  const loading = home.isLoading
  const error = home.error?.message ?? home.data?.error ?? null
  const chart = home.data?.mostHappening ?? []

  return (
    <Screen bleed refreshing={home.isRefetching} onRefresh={() => void home.refetch()}>
      {error && !chart.length ? (
        <View style={{ padding: GUTTER, paddingTop: insets.top + NAV_SPACE, gap: 24 }}>
          <EmptyNote dashed={false}>{error}</EmptyNote>
          <PrimaryButton label="Discover albums" icon="arrow-up-right" onPress={() => router.navigate('/discover')} />
        </View>
      ) : (
        <>
          <HeroDeck albums={chart.slice(0, FEATURED)} loading={loading} />
          <ChartPages albums={chart.slice(FEATURED, CHART_END)} loading={loading} />
          <Shelf title="Fresh pressings" albums={home.data?.recentReleases ?? []} loading={loading} />
        </>
      )}
    </Screen>
  )
}

const SectionTitle = ({ title }: { title: string }) => (
  <T style={{ paddingHorizontal: GUTTER, fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.7 }}>{title}</T>
)

// Edge to edge and up under the status bar and dock, one record per page. It moves on by itself every few
// seconds and waits while your finger is on it.
const HeroDeck = ({ albums, loading }: { albums: Album[]; loading: boolean }) => {
  const { width, height } = useWindowDimensions()
  const tall = Math.min(width * 1.3, height * 0.68)
  const [page, setPage] = useState(0)
  const [holding, setHolding] = useState(false)
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null)

  useEffect(() => {
    if (holding || albums.length < 2) return
    // Android doesn't report the end of a programmatic scroll, so the page is set here rather than on momentum end.
    const timer = setTimeout(() => {
      const next = (page + 1) % albums.length
      scroller.current?.scrollTo({ x: next * width, animated: true })
      setPage(next)
    }, ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [page, holding, albums.length, width])

  if (loading) return <Skeleton style={{ height: tall, borderRadius: 0 }} />
  if (!albums.length) return null
  return (
    <View style={{ height: tall }}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setHolding(true)}
        onScrollEndDrag={() => setHolding(false)}
        onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
      >
        {albums.map((album, index) => <HeroPage key={album.id} album={album} rank={index + 1} width={width} height={tall} active={index === page} />)}
      </ScrollView>
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 18, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {albums.map((album, index) => (
          <View key={album.id} style={{ height: 6, width: index === page ? 18 : 6, borderRadius: 3, backgroundColor: index === page ? colors.paper : 'rgba(238,234,227,0.3)' }} />
        ))}
      </View>
    </View>
  )
}

// The artist's photo (the album page's lookup) over the blurred cover, and their motion video while the page is in view.
const HeroPage = ({ album, rank, width, height, active }: { album: Album; rank: number; width: number; height: number; active: boolean }) => {
  const artist = album.artists?.[0]
  const { data: art } = useQuery({ queryKey: ['artist-image', artist], queryFn: () => getArtistImage(artist!), enabled: Boolean(artist), staleTime: Infinity, retry: false })
  const photo = art?.square?.image ?? art?.image
  const video = art?.square ? art.square.video : art?.video
  return (
    <Press onPress={() => openAlbum(album)} scaleTo={1} style={{ width, height, backgroundColor: colors.panel }} accessibilityRole="link" accessibilityLabel={`Number ${rank} this week: ${album.name}`}>
      <Image source={album.cover} blurRadius={30} style={StyleSheet.absoluteFill} />
      {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: '25%' }} transition={400} /> : null}
      {active ? <HeroVideo key={video} src={video} /> : null}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)', '#000']} locations={[0.4, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', left: GUTTER, right: GUTTER, bottom: 44, flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <View style={styles.badge}>
            <T style={{ fontSize: 12, fontFamily: fonts.semibold, color: colors.paper }}>No. {rank} this week</T>
          </View>
          <Display size={34} numberOfLines={2} style={{ marginTop: 12 }}>{album.name}</Display>
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

// The rest of the top 20 as tappable rows, four to a column, paged sideways so the list never runs down the page.
const ChartPages = ({ albums, loading }: { albums: Album[]; loading: boolean }) => {
  const { width } = useWindowDimensions()
  const { ratings } = useMe()
  const column = width - GUTTER * 2 - 28
  const items = loading ? (Array.from({ length: ROWS_PER_PAGE * 2 }) as Album[]) : albums
  if (!items.length) return null
  const pages = Array.from({ length: Math.ceil(items.length / ROWS_PER_PAGE) }, (_, page) => items.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE))
  return (
    <View style={{ marginTop: 28 }}>
      <SectionTitle title={`Rounding out the top ${CHART_END}`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={column + 12} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 12, paddingTop: 8 }}>
        {pages.map((rows, page) => (
          <View key={page} style={{ width: column }}>
            {rows.map((album, row) => {
              const rank = FEATURED + page * ROWS_PER_PAGE + row + 1
              const line = row < rows.length - 1 && styles.rowLine
              if (loading) return <ChartRowSkeleton key={row} />
              const mine = ratings[String(album.id)]?.rating
              return (
                <Press key={album.id} onPress={() => openAlbum(album)} scaleTo={0.98} style={[styles.row, line]} accessibilityRole="link" accessibilityLabel={`Number ${rank}, ${album.name}`}>
                  <T style={styles.rank}>{rank}</T>
                  <Image source={album.cover} style={styles.rowCover} transition={200} />
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
    <View style={styles.rank} />
    <Skeleton style={styles.rowCover} />
    <View style={{ flex: 1 }}>
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
    <View style={{ marginTop: 24 }}>
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
  badge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5 },
  thumb: { width: 64, height: 64, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  rowCover: { width: 56, height: 56, borderRadius: 6, backgroundColor: colors.panel },
  rank: { width: 24, fontFamily: fonts.bold, fontSize: 17, color: colors.muted },
})
