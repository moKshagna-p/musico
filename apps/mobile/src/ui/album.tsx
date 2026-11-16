import { Feather } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { memo, useId, useState, type ReactNode } from 'react'
import { Dimensions, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'

import { getArtistImage, type Album } from '@/lib/api'
import { Display, Muted, Press, Skeleton, StarValue, T } from './kit'
import { takeOff } from './morph'
import { usePageScroll } from './scroll'
import { colors, display, easeOut, fonts, GUTTER } from './theme'
import { HeroVideo } from './HeroVideo'
import { VinylSleeve } from './vinyl'

// Opening an album hands the card's data along, so the page shows name and cover at once while the rest loads,
// and the card's sleeve flies into the page's sleeve on the way (morph.tsx).
export const openAlbum = async (album: Pick<Album, 'id'> & Partial<Album>, morphKey?: string) => {
  if (morphKey) await takeOff(morphKey, album.cover, albumSleeveRect())
  router.push({
    pathname: '/album/[id]',
    params: {
      id: String(album.id),
      morph: morphKey ?? '',
      seed: JSON.stringify({ id: album.id, name: album.name, cover: album.cover, artists: album.artists, discLabel: album.discLabel, releaseYear: album.releaseYear, communityRating: album.communityRating, reviewCount: album.reviewCount, genres: album.genres }),
    },
  })
}

// Where the album page draws its sleeve: the gutter in, 6rem above the end of the hero art (see Billboard), 120pt square.
// Known up front so the cover can fly while the page is still mounting.
export const ALBUM_SLEEVE = 120
const albumSleeveRect = () => {
  const { width, height } = Dimensions.get('window')
  return { x: GUTTER, y: Math.min(width, height * 0.72) - 96, w: ALBUM_SLEEVE, h: ALBUM_SLEEVE }
}

const yearOf = (album: Album) => album.releaseYear ?? album.releaseDate?.match(/\b(19|20)\d{2}\b/)?.[0] ?? null
// Cards rise 12px and fade in, staggered (the web's initial={{ opacity: 0, y: 12 }}).
export const enter = (index: number) => FadeInDown.delay(Math.min(index, 8) * 45).duration(400).easing(easeOut).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })

// A sleeve that lifts its record out under your finger (the web's crate-pull hover), then opens the album.
export const AlbumCard = memo(({ album, width, index = 0 }: { album: Album; width: number; index?: number }) => {
  const pull = useSharedValue(0)
  const morphKey = `${album.id}:${useId()}`
  const meta = [yearOf(album), album.genres?.[0]].filter(Boolean).join(', ')
  return (
    <Animated.View entering={enter(index)} style={{ width }}>
      <Press onPress={() => openAlbum(album, morphKey)} pressed={pull} scaleTo={0.97} accessibilityRole="link" accessibilityLabel={`Open ${album.name}`}>
        <VinylSleeve size={width} cover={album.cover} label={album.discLabel} pull={pull} morphKey={morphKey} />
        <View style={{ marginTop: 12 }}>
          <T numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.6, lineHeight: 20 }}>{album.name}</T>
          <T numberOfLines={1} style={{ marginTop: 2, fontSize: 14, color: 'rgba(238,234,227,0.65)' }}>{album.artists?.join(', ')}</T>
          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {Number(album.reviewCount) > 0 ? <StarValue value={Number(album.communityRating ?? 0)} /> : null}
            <Muted numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }}>{meta}</Muted>
          </View>
        </View>
      </Press>
    </Animated.View>
  )
})

export const AlbumCardSkeleton = ({ width }: { width: number }) => (
  <View style={{ width }}>
    <Skeleton style={{ width, height: width, borderRadius: 4 }} />
    <Skeleton style={{ marginTop: 14, height: 15, width: width * 0.8 }} />
    <Skeleton style={{ marginTop: 8, height: 12, width: width * 0.55 }} />
  </View>
)

// Two-up grid for search results and Discover (gap-x-5 gap-y-10 on the web).
export const AlbumGrid = ({ albums, loading, inset = true }: { albums: Album[]; loading?: boolean; inset?: boolean }) => {
  const { width: screen } = useWindowDimensions()
  const width = (screen - GUTTER * 2 - 20) / 2
  const items = loading ? (Array.from({ length: 6 }) as Album[]) : albums
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 40, paddingHorizontal: inset ? GUTTER : 0, paddingTop: 40 }}>
      {items.map((album, index) =>
        loading ? <AlbumCardSkeleton key={index} width={width} /> : <AlbumCard key={`${album.id}-${index}`} album={album} width={width} index={index % 12} />,
      )}
    </View>
  )
}

// Linked cover + caption for user-owned collections (lists, ratings, history), the web's AlbumTile.
export const AlbumTile = ({ album, width, rating, meta, index = 0 }: { album: { id: string; name?: string; cover?: string | null; artists?: string[] }; width: number; rating?: number | null; meta?: string; index?: number }) => {
  const pull = useSharedValue(0)
  const morphKey = `${album.id}:${useId()}`
  return (
    <Animated.View entering={enter(index)} style={{ width }}>
      <Press onPress={() => openAlbum(album, morphKey)} pressed={pull} scaleTo={0.97}>
        <View style={{ paddingRight: width * 0.12 }}>
          <VinylSleeve size={width * 0.88} cover={album.cover} pull={pull} morphKey={morphKey} />
        </View>
        <T numberOfLines={2} style={[display(20), { marginTop: 16, lineHeight: 22 }]}>{album.name || 'Untitled album'}</T>
        <T numberOfLines={1} style={{ marginTop: 4, fontSize: 14, color: 'rgba(238,234,227,0.7)' }}>{album.artists?.[0] || 'Unknown artist'}</T>
        {rating != null || meta ? (
          <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <Muted numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }}>{meta ?? ''}</Muted>
            {rating != null ? <StarValue value={rating} color={colors.paper} /> : null}
          </View>
        ) : null}
      </Press>
    </Animated.View>
  )
}

// One cover in a list card's stack; pressing fans the stack out (the web's hover spread).
const StackedCover = ({ cover, index, spread }: { cover?: string | null; index: number; spread: SharedValue<number> }) => {
  const fan = useAnimatedStyle(() => ({ transform: [{ translateX: spread.value * index * 12 }] }))
  return (
    <Animated.View style={[styles.stacked, { zIndex: 4 - index, marginLeft: index ? -32 : 0 }, fan]}>
      {cover ? <Image source={cover} style={StyleSheet.absoluteFill} transition={250} /> : null}
    </Animated.View>
  )
}

export const ListCard = ({ list, index = 0 }: { list: { id: string; name: string; albumCount?: number; albums?: { id?: string; cover?: string | null }[] }; index?: number }) => {
  const albums = list.albums ?? []
  const shown = albums.slice(0, 4)
  const count = list.albumCount ?? albums.length
  const spread = useSharedValue(0)
  const client = useQueryClient()
  // Hand the list page what the card already has (name, count, first covers) so it opens filled while the rest loads.
  // Stamped as updated at time 0 so it is already stale: with the app's 5-minute staleTime, a fresh stamp kept the page
  // from fetching the rest of the list at all.
  const open = () => {
    if (!client.getQueryData(['public-list', list.id])) client.setQueryData(['public-list', list.id], { id: list.id, name: list.name, albumCount: count, albums }, { updatedAt: 0 })
    router.push({ pathname: '/list/[id]', params: { id: list.id } })
  }
  return (
    <Animated.View entering={enter(index)}>
      <Press onPress={open} pressed={spread} style={styles.listCard} scaleTo={0.98}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Display size={24} numberOfLines={1}>{list.name}</Display>
            <Muted style={{ marginTop: 4 }}>{count} {count === 1 ? 'album' : 'albums'}</Muted>
          </View>
          <Feather name="arrow-up-right" size={20} color={colors.muted} />
        </View>
        <View style={{ marginTop: 32, height: 96, flexDirection: 'row', alignItems: 'flex-end' }}>
          {shown.length ? (
            shown.map((album, i) => <StackedCover key={album.id ?? i} cover={album.cover} index={i} spread={spread} />)
          ) : (
            <Muted>Empty for now. Add albums from any album page.</Muted>
          )}
          {count > 4 ? <T style={styles.more}>+{count - 4} more</T> : null}
        </View>
      </Press>
    </Animated.View>
  )
}

// Full-bleed hero: the blurred album art shows at once, and the artist's photo fades in over it when found.
// Phones get a square of art across the top that fades into the page, with the text starting 6rem into the fade —
// the web's layout below `tablet`. The art drifts at half the scroll speed and stretches when you pull down.
export const Billboard = ({ artist, cover, children }: { artist?: string; cover?: string | null; children: ReactNode }) => {
  const { scrollY } = usePageScroll()
  const { width, height } = useWindowDimensions()
  const art = Math.min(width, height * 0.72)
  const [loaded, setLoaded] = useState<string | null>(null)
  const { data: artistArt } = useQuery({
    queryKey: ['artist-image', artist],
    queryFn: () => getArtistImage(artist!),
    enabled: Boolean(artist),
    staleTime: Infinity,
    retry: false,
  })
  const photo = artistArt?.square?.image ?? artistArt?.image
  // The motion hero for the same cut as the photo: the square one on phones, like the web.
  const video = artistArt?.square ? artistArt.square.video : artistArt?.video
  const parallax = useAnimatedStyle(() => ({
    transform: [
      { translateY: scrollY.value < 0 ? scrollY.value : scrollY.value * 0.5 },
      { scale: interpolate(scrollY.value, [-240, 0], [1.5, 1], Extrapolation.CLAMP) },
    ],
  }))

  return (
    <View>
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, parallax]}>
          {/* RN can't mask the photo to transparent like the web, so the blur steps back once the photo is in.
              The photo and its fade to black come in together: shown before the photo loads (or when it never does),
              the fade ends in a hard black edge at `art` with the blur still showing below it. */}
          {cover ? (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: loaded === photo && photo ? 0 : 0.5 }, FADE]}>
              <Image source={cover} blurRadius={40} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.25 }] }]} transition={700} />
            </Animated.View>
          ) : null}
          {photo ? (
            <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: art, opacity: loaded === photo ? 1 : 0 }, FADE]}>
              <Image source={photo} style={{ width: '100%', height: '100%' }} contentPosition={{ top: '25%' }} contentFit="cover" onLoad={() => setLoaded(photo)} />
              <HeroVideo key={video} src={video} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)', '#000']} locations={[0.55, 0.8, 1]} style={StyleSheet.absoluteFill} />
            </Animated.View>
          ) : null}
        </Animated.View>
        <LinearGradient colors={['rgba(0,0,0,0.7)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160 }} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)', '#000']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' }} />
      </View>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: art - 96, paddingBottom: 40 }}>{children}</View>
    </View>
  )
}

// Reanimated CSS transition: the hero's layers cross-fade whenever their opacity changes.
const FADE = { transitionProperty: 'opacity', transitionDuration: 700 } as const

const styles = StyleSheet.create({
  listCard: { borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(255,255,255,0.02)', padding: 20, overflow: 'hidden' },
  stacked: { width: 96, height: 96, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  more: { marginLeft: 'auto', fontSize: 12, color: colors.muted, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, overflow: 'hidden' },
})
