import { Feather } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated'

import { getRelease, getStreamingLinks, searchStreamingLinks, type Album } from '@/lib/api'
import { useAuth, useMe } from '@/lib/state'
import { ALBUM_SLEEVE, Billboard } from '@/ui/album'
import { ArtistName, Display, Muted, Pill, Press, RatingStars, Skeleton, StreamingLinks, T, scalesUp } from '@/ui/kit'
import { flyHome, land } from '@/ui/morph'
import { Reviews } from '@/ui/reviews'
import { Screen } from '@/ui/Screen'
import { colors, display, easeOut, fonts, GUTTER } from '@/ui/theme'
import { VinylSleeve } from '@/ui/vinyl'

const formatDuration = (ms?: number) => {
  if (!ms) return '–'
  const minutes = Math.floor(ms / 60000)
  return `${minutes}:${Math.round((ms % 60000) / 1000).toString().padStart(2, '0')}`
}
const formatCount = (value = 0) => (value > 999999 ? `${(value / 1e6).toFixed(1)}M` : value > 999 ? `${(value / 1000).toFixed(1)}K` : String(value))
const rise = (delay: number) => FadeInDown.delay(delay).duration(500).easing(easeOut).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })

export default function AlbumScreen() {
  const { id, seed: seedParam, morph } = useLocalSearchParams<{ id: string; seed?: string; morph?: string }>()
  const navigation = useNavigation()
  const { height } = useWindowDimensions()
  const { user } = useAuth()
  const me = useMe()
  const signedIn = Boolean(user?.id)
  const sleeve = useRef<ComponentRef<typeof View>>(null)
  // The hero renders first so the page is on screen while the cover is still in flight; everything below it
  // (tracklist, lists, reviews, footer) follows a frame later.
  const [below, setBelow] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setBelow(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // The card that linked here already has name, cover and stats; show those now and let the tracklist load in.
  const seed = useMemo(() => {
    try {
      const parsed = seedParam ? JSON.parse(seedParam) : null
      return String(parsed?.id) === id ? (parsed as Album) : undefined
    } catch {
      return undefined
    }
  }, [seedParam, id])
  const release = useQuery({ queryKey: ['release', id], queryFn: () => getRelease(id), enabled: Boolean(id), placeholderData: seed })
  // Keep the card's cover so the art already on screen isn't swapped and downloaded again.
  const album = useMemo(() => (release.data && seed?.cover ? { ...release.data, cover: seed.cover } : release.data), [release.data, seed])
  const loadingTracks = release.isPlaceholderData
  const artist = album?.artists?.[0]
  const { data: directLinks } = useQuery({
    queryKey: ['streaming-links', artist, album?.name],
    queryFn: () => getStreamingLinks(artist!, album!.name),
    enabled: Boolean(artist && album?.name),
    staleTime: Infinity,
    retry: false,
  })
  const links = useMemo(() => ({ ...searchStreamingLinks(album), ...directLinks }), [album, directLinks])

  // Leaving (back button, Android back, iOS swipe): the sleeve flies home to the tile that opened it.
  useEffect(() => {
    if (!morph) return
    return navigation.addListener('transitionStart' as never, (event: { data?: { closing?: boolean } }) => {
      if (event.data?.closing) void flyHome(morph, album?.cover, sleeve.current, height)
    })
  }, [navigation, morph, album?.cover, height])

  if (release.isLoading) {
    return (
      <Screen bleed footer={false}>
        <View style={{ paddingTop: height * 0.5, paddingHorizontal: GUTTER }}>
          <Skeleton style={{ width: 120, height: 120, borderRadius: 4 }} />
          <Skeleton style={{ marginTop: 32, height: 14, width: 120 }} />
          <Skeleton style={{ marginTop: 16, height: 46, width: '85%', borderRadius: 12 }} />
        </View>
      </Screen>
    )
  }
  if (release.error || !album) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', paddingVertical: 64 }}>
          <Display size={36} style={{ textAlign: 'center' }}>This record won’t play.</Display>
          <Muted style={{ marginTop: 12, textAlign: 'center' }}>{release.error?.message ?? 'Unable to load album details.'}</Muted>
          <Pill label="Go back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/discover'))} style={{ marginTop: 24 }} />
        </View>
      </Screen>
    )
  }

  const community = { average: Number(album.communityRating ?? 0), total: Number(album.reviewCount ?? 0) }
  const year = album.releaseYear ?? album.releaseDate?.match(/\b(19|20)\d{2}\b/)?.[0] ?? 'Unknown'
  const genres = album.genres?.length ? album.genres.slice(0, 3).join(', ') : 'Unknown genre'

  return (
    <Screen bleed footer={below}>
      <Billboard artist={artist} cover={album.cover}>
        <View style={{ width: 176, paddingRight: 56, marginBottom: 32 }}>
          <VinylSleeve
            size={ALBUM_SLEEVE}
            cover={album.cover}
            label={album.discLabel}
            out
            spin
            morphKey={morph || undefined}
            sleeveRef={sleeve}
            onSleeveReady={() => morph && void land(morph, sleeve.current, height)}
          />
        </View>
        <Animated.View entering={rise(150)}>
          {/* Links from profiles, lists and the feed only seed name and cover; hold this line's space until the rest loads. */}
          <T style={{ fontSize: 14, fontFamily: fonts.medium, color: 'rgba(238,234,227,0.7)', opacity: loadingTracks && !album.genres?.length ? 0 : 1 }}>
            {year}, {genres}
          </T>
          <Display size={48} style={{ marginTop: 12 }}>{album.name}</Display>
          <View style={{ marginTop: 12 }}>
            <ArtistName artists={album.artists} logoHeight={40} style={{ fontSize: 20, fontFamily: fonts.medium, color: 'rgba(238,234,227,0.85)' }} />
          </View>
        </Animated.View>

        <Animated.View entering={rise(250)} style={{ marginTop: 28, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 40, rowGap: 20 }}>
          <View>
            <Muted style={{ color: 'rgba(238,234,227,0.6)' }}>Community score</Muted>
            {community.total > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <T style={display(48)}>{community.average.toFixed(1)}</T>
                <Muted style={{ color: 'rgba(238,234,227,0.6)' }}>{formatCount(community.total)} {community.total === 1 ? 'vote' : 'votes'}</Muted>
              </View>
            ) : (
              <T style={{ marginTop: 4, fontSize: 20, fontFamily: fonts.medium, color: 'rgba(238,234,227,0.85)' }}>No ratings yet</T>
            )}
          </View>
          <View>
            <Muted style={{ color: 'rgba(238,234,227,0.6)', marginBottom: 4 }}>{signedIn ? 'Your rating' : 'Sign in required to rate'}</Muted>
            <RatingStars value={me.ratings[String(album.id)]?.rating ?? 0} readOnly={!signedIn} onRate={(value) => me.rateAlbum(album, value)} />
          </View>
        </Animated.View>

        <Animated.View entering={rise(350)} style={{ marginTop: 40 }}>
          <StreamingLinks links={links} />
        </Animated.View>
      </Billboard>

      {below ? <View style={{ paddingHorizontal: GUTTER, marginTop: 40, gap: 64 }}>
        <View>
          <Display size={30}>Tracklist</Display>
          <View style={{ marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line }}>
            {loadingTracks ? (
              Array.from({ length: 6 }, (_, index) => (
                <View key={index} style={styles.track}><Skeleton style={{ height: 14, width: `${50 + ((index * 17) % 35)}%` }} /></View>
              ))
            ) : album.tracks?.length ? (
              album.tracks.map((track, index) => (
                <Animated.View key={track.id ?? `${index}`} entering={FadeIn.delay(Math.min(index, 14) * 25).duration(300)} style={styles.track}>
                  <Muted style={{ width: 32 }}>{index + 1}</Muted>
                  <T numberOfLines={1} style={{ flex: 1 }}>{track.name}</T>
                  <Muted style={{ width: 56, textAlign: 'right' }}>{formatDuration(track.duration_ms)}</Muted>
                </Animated.View>
              ))
            ) : (
              <Muted style={{ paddingVertical: 24, paddingHorizontal: 4 }}>Track details are not available for this release.</Muted>
            )}
          </View>
        </View>

        <ListsPanel album={album} signedIn={signedIn} />
        <View style={{ marginTop: 16 }}><Reviews album={album} signedIn={signedIn} /></View>
      </View> : null}
    </Screen>
  )
}

// "Save to a list", as on the web: Listen Later, every list as a tilted chip, and a field to start a new one.
const ListsPanel = ({ album, signedIn }: { album: Album; signedIn: boolean }) => {
  const me = useMe()
  const [status, setStatus] = useState('')
  const [newList, setNewList] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const inLists = new Set(me.lists.filter((list) => list.albums.some((entry) => entry.id === String(album.id))).map((list) => list.id))
  const inListenLater = Boolean(me.listenLater?.albums.some((entry) => entry.id === String(album.id)))
  const disabled = !signedIn || me.loadingLists

  const toggle = async (listId: string) => {
    if (!signedIn) return setStatus('Sign in to update lists.')
    setBusy(listId)
    const result = await me.toggleInList(listId, album)
    setBusy(null)
    setStatus(result.ok ? (result.added ? `Added to ${result.listName}.` : `Removed from ${result.listName}.`) : 'Unable to update list right now.')
  }
  const toggleLater = async () => {
    if (!signedIn) return setStatus('Sign in to save albums to Listen Later.')
    setBusy('listen-later')
    const result = await me.toggleListenLater(album)
    setBusy(null)
    setStatus(result.ok ? (result.added ? 'Added to Listen Later.' : 'Removed from Listen Later.') : 'Unable to update Listen Later right now.')
  }
  const create = async () => {
    if (!signedIn) return setStatus('Sign in to create and manage lists.')
    const result = await me.createList(newList, album)
    if (!result.ok) {
      setStatus({ duplicate: 'A list with this name already exists.', limit: 'You reached the list limit. Remove one list to create another.', auth: 'Sign in to create lists.', empty: 'Enter a list name to continue.' }[result.reason ?? ''] ?? 'Unable to create that list right now.')
      return
    }
    setNewList('')
    setStatus(`Created ${result.list!.name} and added this album.`)
  }

  return (
    <Animated.View layout={LinearTransition.duration(300).easing(easeOut)} style={styles.panel}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <Display size={24}>Save to a list</Display>
        <Muted style={{ fontSize: 12 }}>{me.loadingLists && signedIn ? 'Loading your lists' : `${inLists.size} of ${me.lists.length}`}</Muted>
      </View>
      <Pill
        label="Listen Later"
        icon={inListenLater ? 'check' : 'plus'}
        active={inListenLater}
        trailing={me.listenLater?.albums.length ?? 0}
        onPress={toggleLater}
        disabled={disabled || busy === 'listen-later'}
        style={{ marginTop: 16, justifyContent: 'space-between' }}
        stretch
      />
      <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {me.lists.filter((list) => list.id !== me.listenLater?.id).map((list, index) => (
          // A little tilt per chip, like stickers on a crate (the web's rotate classes).
          <Animated.View key={list.id} entering={FadeIn.delay(index * 40)} style={{ transform: [{ rotate: `${[-1.5, 1.2, -0.6, 1.6][index % 4]}deg` }] }}>
            <Pill
              label={list.name}
              icon={inLists.has(list.id) ? 'check' : 'plus'}
              active={inLists.has(list.id)}
              trailing={busy === list.id ? '…' : list.albums.length}
              onPress={() => toggle(list.id)}
              disabled={busy === list.id}
            />
          </Animated.View>
        ))}
        {signedIn && !me.loadingLists && me.lists.length === 0 ? <Muted>No lists yet. Name your first one below.</Muted> : null}
      </View>
      <View style={[styles.newList, disabled && { opacity: 0.5 }]}>
        <TextInput allowFontScaling={scalesUp}
          value={newList}
          onChangeText={setNewList}
          onSubmitEditing={create}
          editable={!disabled}
          placeholder="New list"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          style={{ flex: 1, color: colors.paper, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 8 }}
        />
        <Press onPress={create} disabled={disabled} style={[styles.plus, disabled && { opacity: 0.6 }]} accessibilityLabel="Create list">
          <Feather name="plus" size={16} color="#000" />
        </Press>
      </View>
      {!signedIn ? (
        <Muted style={{ marginTop: 16 }}>
          <Muted style={{ color: colors.paper, textDecorationLine: 'underline' }} onPress={() => router.push('/auth')}>Sign in</Muted> to create lists and save albums.
        </Muted>
      ) : null}
      <Muted style={{ marginTop: 16, fontSize: 12, minHeight: 16 }}>{status || (signedIn ? 'Tap a list to add or remove this album.' : '')}</Muted>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  panel: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.025)', padding: 20 },
  newList: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.4)', padding: 4, paddingLeft: 16 },
  plus: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
})
