import { Feather } from '@expo/vector-icons'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated'

import { fetchAlbumReviews, fetchMyReviews, saveReview, searchGifs, uploadReviewImage, type Album } from '@/lib/api'
import { toDraft, type Gif, type Picked, type SavedMedia } from '@/lib/reviewDraft'
import { Avatar, Display, EmptyNote, formatTimeAgo, Muted, Pill, Press, RatingStars, Skeleton, T, scalesUp } from './kit'
import { colors, easeOut, fonts } from './theme'

const MAX_IMAGES = 4
const MAX_LENGTH = 280
// Same budget as the web's prepareReviewImage: the long edge capped at 2048px, re-encoded small.
const MAX_EDGE = 2048
const unfold = FadeInDown.duration(300).easing(easeOut)

type MediaItem = SavedMedia

// Tweet-style layouts, as on the web: one item keeps its shape, 2-4 share a 16:9 frame (the first of three runs tall).
// Tiles are sized from the frame's own measured width, since the composer's padding makes it narrower than the page.
export const MediaGrid = <T extends { width?: number; height?: number }>({ items, renderTile }: { items: T[]; renderTile: (item: T, index: number) => React.ReactNode }) => {
  const [frameWidth, setFrameWidth] = useState(0)
  if (!items.length) return null
  if (items.length === 1) {
    const [item] = items
    const ratio = item.width && item.height ? Math.min(Math.max(item.width / item.height, 0.75), 2.5) : 16 / 9
    return <View style={[styles.frame, { aspectRatio: ratio, maxHeight: 512 }]}>{renderTile(item, 0)}</View>
  }
  const inner = frameWidth - 2 // inside the 1pt border
  const half = (inner - 2) / 2
  const height = (inner * 9) / 16
  const cell = items.length > 2 ? (height - 2) / 2 : height
  return (
    <View onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)} style={[styles.frame, { aspectRatio: 16 / 9, flexDirection: 'column', flexWrap: 'wrap', gap: 2 }]}>
      {frameWidth > 0 && items.map((item, index) => (
        <View key={index} style={{ width: half, height: items.length === 3 && index === 0 ? cell * 2 + 2 : cell }}>
          {renderTile(item, index)}
        </View>
      ))}
    </View>
  )
}

// Images in a review open full screen; the tile zooms up into the viewer (the web's review-media morph).
export const ReviewMedia = ({ media = [] }: { media?: MediaItem[] }) => {
  const [open, setOpen] = useState<number | null>(null)
  const images = media.filter((item) => item.kind === 'image')
  if (!media.length) return null
  return (
    <View style={{ marginTop: 16 }}>
      <MediaGrid
        items={media}
        renderTile={(item) =>
          item.kind === 'gif' ? (
            <View style={{ flex: 1 }}>
              <Image source={item.url} style={StyleSheet.absoluteFill} contentFit="cover" />
              <T style={styles.gifBadge}>GIF</T>
            </View>
          ) : (
            <Pressable style={{ flex: 1 }} onPress={() => setOpen(images.indexOf(item))} accessibilityLabel={item.alt ? `View image: ${item.alt}` : 'View image'}>
              <Image source={item.url} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            </Pressable>
          )
        }
      />
      <Modal visible={open !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.lightbox} onPress={() => setOpen(null)}>
          {open !== null && images[open] ? (
            <Animated.View key={open} entering={ZoomIn.duration(450).easing(easeOut)} exiting={ZoomOut.duration(200)} style={{ width: '100%', height: '80%' }}>
              <Image source={images[open].url} style={{ flex: 1 }} contentFit="contain" />
              {images[open].alt ? <T style={{ marginTop: 12, textAlign: 'center', fontSize: 14, color: 'rgba(238,234,227,0.75)' }}>{images[open].alt}</T> : null}
            </Animated.View>
          ) : null}
          <Pressable onPress={() => setOpen(null)} style={[styles.round, { position: 'absolute', top: 56, right: 16 }]} accessibilityLabel="Close">
            <Feather name="x" size={20} color={colors.paper} />
          </Pressable>
          {images.length > 1 ? (
            <>
              <Pressable onPress={() => setOpen(((open ?? 0) - 1 + images.length) % images.length)} style={[styles.round, { position: 'absolute', left: 12, top: '50%' }]} accessibilityLabel="Previous image">
                <Feather name="chevron-left" size={20} color={colors.paper} />
              </Pressable>
              <Pressable onPress={() => setOpen(((open ?? 0) + 1) % images.length)} style={[styles.round, { position: 'absolute', right: 12, top: '50%' }]} accessibilityLabel="Next image">
                <Feather name="chevron-right" size={20} color={colors.paper} />
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  )
}

// Trending until you type; the API proxies KLIPY, so keystrokes are debounced to spare its hourly cap.
const GifPicker = ({ onPick, onClose }: { onPick: (gif: Gif) => void; onClose: () => void }) => {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])
  const gifs = useQuery({ queryKey: ['gifs', debounced], queryFn: () => searchGifs(debounced), staleTime: 1000 * 60 * 5, retry: false })
  const columns: Gif[][] = [[], []]
  gifs.data?.forEach((gif, index) => columns[index % 2].push(gif))
  return (
    <Animated.View entering={unfold} exiting={FadeOut.duration(150)} style={styles.gifPanel}>
      <View style={styles.gifSearch}>
        <Feather name="search" size={15} color={colors.muted} />
        <TextInput allowFontScaling={scalesUp} autoFocus value={query} onChangeText={(value) => setQuery(value.slice(0, 120))} placeholder="Search KLIPY" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.paper, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 8 }} />
        <Pressable hitSlop={10} onPress={onClose} accessibilityLabel="Close GIF search"><Feather name="x" size={16} color={colors.muted} /></Pressable>
      </View>
      <View style={{ maxHeight: 320 }}>
        {gifs.isPending ? (
          <View style={{ flexDirection: 'row', gap: 8, padding: 8 }}>
            {[[120, 90, 150], [100, 130, 80]].map((heights, column) => (
              <View key={column} style={{ flex: 1, gap: 8 }}>{heights.map((height, i) => <Skeleton key={i} style={{ height, borderRadius: 8 }} />)}</View>
            ))}
          </View>
        ) : gifs.isError ? (
          <Muted style={{ padding: 24, textAlign: 'center' }}>{(gifs.error as { status?: number })?.status === 503 ? 'GIF search is not set up yet.' : 'GIFs could not be loaded right now.'}</Muted>
        ) : !gifs.data?.length ? (
          <Muted style={{ padding: 24, textAlign: 'center' }}>No GIFs found.</Muted>
        ) : (
          <Animated.ScrollView nestedScrollEnabled contentContainerStyle={{ flexDirection: 'row', gap: 8, padding: 8 }}>
            {columns.map((column, i) => (
              <View key={i} style={{ flex: 1, gap: 8 }}>
                {column.map((gif) => (
                  <Press key={gif.id} onPress={() => onPick(gif)} style={{ aspectRatio: gif.width / gif.height, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                    <Image source={gif.preview} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </Press>
                ))}
              </View>
            ))}
          </Animated.ScrollView>
        )}
      </View>
      <Muted style={styles.klipy}>Powered by KLIPY</Muted>
    </Animated.View>
  )
}

// Composer with tweet-style media: up to 4 images or one GIF. Images upload as soon as they're picked,
// so Post only has to attach them (the web's ReviewInput). Each person has one review per album and saving replaces
// it, so a saved review opens here for editing, attachments included, rather than being silently overwritten.
export const ReviewComposer = ({ album, saved }: { album: Album; saved?: { content?: string | null; media?: SavedMedia[] } | null }) => {
  const queryClient = useQueryClient()
  const [draft] = useState(() => toDraft(saved))
  const [content, setContent] = useState(draft.content)
  const [images, setImages] = useState<Picked[]>(draft.images)
  const [gif, setGif] = useState<Gif | null>(draft.gif)
  const [pickingGif, setPickingGif] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const patch = (localId: string, next: Partial<Picked>) => setImages((current) => current.map((image) => (image.localId === localId ? { ...image, ...next } : image)))

  const pickImages = async () => {
    if (gif) return setStatus('Remove the GIF to add images.')
    const room = MAX_IMAGES - images.length
    if (room <= 0) return setStatus(`You can add up to ${MAX_IMAGES} images.`)
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 1 })
    if (result.canceled) return
    setPickingGif(false)
    setStatus(result.assets.length > room ? `You can add up to ${MAX_IMAGES} images.` : '')
    for (const asset of result.assets.slice(0, room)) {
      const localId = `${Date.now()}-${Math.random()}`
      setImages((current) => [...current, { localId, uri: asset.uri, width: asset.width, height: asset.height, status: 'uploading' }])
      const isGif = asset.mimeType === 'image/gif'
      const scale = Math.min(1, MAX_EDGE / Math.max(asset.width, asset.height))
      const prepare = isGif
        ? Promise.resolve({ uri: asset.uri, width: asset.width, height: asset.height, mimeType: 'image/gif' })
        : ImageManipulator.manipulate(asset.uri)
            .resize({ width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) })
            .renderAsync()
            .then((image) => image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 }))
            .then((saved) => ({ uri: saved.uri, width: saved.width, height: saved.height, mimeType: 'image/jpeg' }))
      prepare
        .then(async (prepared) => {
          patch(localId, { width: prepared.width, height: prepared.height })
          const uploaded = await uploadReviewImage(prepared)
          patch(localId, { id: uploaded.id, status: 'done' })
        })
        .catch((error) => patch(localId, { status: 'error', error: (error as Error).message ?? 'Upload failed.' }))
    }
  }

  const uploading = images.some((image) => image.status === 'uploading')
  const failed = images.some((image) => image.status === 'error')
  const canPost = Boolean(content.trim() || images.length || gif) && !uploading && !failed && !saving

  const post = async () => {
    if (!canPost) return
    setSaving(true)
    setStatus('')
    try {
      await saveReview(album.id, {
        content: content.trim(),
        albumName: album.name,
        albumCover: album.cover,
        albumArtists: album.artists,
        media: images.map((image) => ({ id: image.id!, alt: '' })),
        gif: gif && { url: gif.url, width: gif.width, height: gif.height, alt: gif.title?.slice(0, 1000) ?? '' },
      })
      setPickingGif(false)
      setStatus(saved ? 'Review updated.' : 'Review posted.')
      await queryClient.invalidateQueries({ queryKey: ['album-reviews', album.id] })
      await queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
    } catch (error) {
      setStatus((error as Error).message ?? 'Failed to save review.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Animated.View layout={LinearTransition.duration(300).easing(easeOut)} style={styles.compose}>
      <TextInput allowFontScaling={scalesUp}
        value={content}
        onChangeText={(value) => setContent(value.slice(0, MAX_LENGTH))}
        placeholder="What stayed with you?"
        placeholderTextColor={colors.muted}
        multiline
        style={styles.composeInput}
      />
      {images.length ? (
        <Animated.View entering={unfold} style={{ marginTop: 12 }}>
          <MediaGrid
            items={images}
            renderTile={(image) => (
              <Animated.View entering={ZoomIn.duration(300).easing(easeOut)} style={{ flex: 1 }}>
                <Image source={image.uri} style={[StyleSheet.absoluteFill, image.status !== 'done' && { opacity: 0.6 }]} contentFit="cover" />
                {image.status === 'uploading' ? <ActivityIndicator color={colors.paper} style={StyleSheet.absoluteFill} /> : null}
                {image.status === 'error' ? <T style={styles.tileError}>{image.error ?? 'Upload failed.'}</T> : null}
                <Pressable onPress={() => setImages((current) => current.filter((item) => item.localId !== image.localId))} style={styles.remove} accessibilityLabel="Remove image">
                  <Feather name="x" size={14} color={colors.paper} />
                </Pressable>
              </Animated.View>
            )}
          />
        </Animated.View>
      ) : null}
      {gif ? (
        <Animated.View entering={unfold} style={{ marginTop: 12 }}>
          <MediaGrid
            items={[gif]}
            renderTile={() => (
              <View style={{ flex: 1 }}>
                <Image source={gif.url} style={StyleSheet.absoluteFill} contentFit="cover" />
                <T style={styles.gifBadge}>GIF</T>
                <Pressable onPress={() => setGif(null)} style={styles.remove} accessibilityLabel="Remove GIF"><Feather name="x" size={14} color={colors.paper} /></Pressable>
              </View>
            )}
          />
        </Animated.View>
      ) : null}
      {pickingGif ? <GifPicker onPick={(picked) => { setGif(picked); setPickingGif(false); setStatus('') }} onClose={() => setPickingGif(false)} /> : null}
      <View style={styles.toolbar}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable onPress={pickImages} disabled={Boolean(gif) || images.length >= MAX_IMAGES} style={styles.tool} accessibilityLabel="Add images">
            <Feather name="image" size={18} color={gif || images.length >= MAX_IMAGES ? 'rgba(142,139,133,0.4)' : colors.muted} />
          </Pressable>
          <Pressable onPress={() => (images.length ? setStatus('Remove the images to add a GIF.') : setPickingGif((open) => !open))} style={styles.tool} accessibilityLabel="Add a GIF">
            <T style={[styles.gifTool, (images.length > 0 || gif) && { opacity: 0.4 }]}>GIF</T>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Muted style={{ fontSize: 12, color: content.length > MAX_LENGTH - 20 ? '#fbbf24' : colors.muted }}>{MAX_LENGTH - content.length}</Muted>
          <Press onPress={post} disabled={!canPost} style={[styles.post, !canPost && { opacity: 0.4 }]}>
            {saving ? <ActivityIndicator color="#000" size="small" /> : <T style={{ color: '#000', fontFamily: fonts.medium, fontSize: 13 }}>{saved ? 'Update review' : 'Post review'}</T>}
          </Press>
        </View>
      </View>
      {status ? <Animated.View entering={FadeIn}><Muted style={{ marginTop: 10, fontSize: 12, color: status === 'Review posted.' || status === 'Review updated.' ? '#4ade80' : colors.muted }}>{status}</Muted></Animated.View> : null}
    </Animated.View>
  )
}

export const ReviewCard = ({ review, index }: { review: any; index: number }) => (
  <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(400).easing(easeOut)} style={styles.review}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <Pressable
        disabled={!review.user?.username}
        onPress={() => router.push({ pathname: '/user/[username]', params: { username: review.user.username } })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
      >
        <Avatar person={review.user} />
        <View style={{ flex: 1 }}>
          <T numberOfLines={1} style={{ fontSize: 14, fontFamily: fonts.medium }}>{review.user?.name ?? 'Anonymous'}</T>
          {review.user?.username ? <Muted numberOfLines={1} style={{ fontSize: 12 }}>@{review.user.username}</Muted> : null}
        </View>
      </Pressable>
      {review.rating != null ? <RatingStars value={Number(review.rating)} readOnly size={22} /> : null}
    </View>
    {review.content ? <T style={{ marginTop: 16, fontSize: 17, lineHeight: 27, color: 'rgba(238,234,227,0.9)' }}>{review.content}</T> : null}
    <ReviewMedia media={review.media} />
    <Muted style={{ marginTop: 12, fontSize: 12 }}>{formatTimeAgo(review.createdAt)}</Muted>
  </Animated.View>
)

export const Reviews = ({ album, signedIn }: { album: Album; signedIn: boolean }) => {
  const reviews = useInfiniteQuery({
    queryKey: ['album-reviews', album.id],
    queryFn: ({ pageParam }) => fetchAlbumReviews(album.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
    enabled: signedIn,
  })
  const items = reviews.data?.pages.flatMap((page) => page.reviews) ?? []
  // Your saved review for this album (text from /me/reviews; its attachments come with it in the album's list).
  const mine = useQuery({ queryKey: ['my-reviews'], queryFn: fetchMyReviews, enabled: signedIn })
  const own = mine.data?.find((review) => String(review.albumId) === String(album.id))
  const saved = own ? (items.find((review) => review.id === own.id) ?? null) : null
  // The composer opens once we know whether there's a review to edit. After a save it keeps what was saved,
  // so it's already the edit view of the new review.
  const composerReady = mine.isFetched && !reviews.isLoading
  return (
    <View>
      <Display size={30}>Reviews</Display>
      {!signedIn ? (
        <View style={{ marginTop: 24 }}>
          <EmptyNote align="left">
            <Muted style={{ color: colors.paper, textDecorationLine: 'underline' }} onPress={() => router.push('/auth')}>Sign in</Muted> to read and write reviews.
          </EmptyNote>
        </View>
      ) : (
        <View style={{ marginTop: 24 }}>
          {composerReady ? (
            <ReviewComposer album={album} saved={saved ?? (own ? { content: own.content, media: [] } : null)} />
          ) : (
            <Skeleton style={{ height: 150, borderRadius: 16 }} />
          )}
          {own && !saved ? <Muted style={{ marginTop: 10, fontSize: 12 }}>Saving replaces your earlier review for this album.</Muted> : null}
          {reviews.isLoading ? <ActivityIndicator color={colors.paper} style={{ marginTop: 24 }} /> : null}
          {reviews.isError && !items.length ? (
            <View style={{ marginTop: 24, gap: 16, alignItems: 'flex-start' }}>
              <Muted>{reviews.error?.message ?? 'Reviews could not be loaded.'}</Muted>
              <Pill label="Retry" icon="refresh-cw" onPress={() => reviews.refetch()} />
            </View>
          ) : null}
          {items.map((review, index) => <ReviewCard key={review.id ?? index} review={review} index={index} />)}
          {reviews.hasNextPage ? (
            <View style={{ alignItems: 'center', marginTop: 24 }}>
              <Pill label={reviews.isFetchingNextPage ? 'Loading' : 'Load more reviews'} onPress={() => reviews.fetchNextPage()} />
            </View>
          ) : null}
          {!reviews.isLoading && !reviews.isError && !items.length ? <Muted style={{ marginTop: 24 }}>No reviews yet. Be the first to write one.</Muted> : null}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 544, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', backgroundColor: colors.panel },
  gifBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11, fontFamily: fonts.semibold, overflow: 'hidden' },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  gifPanel: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0b0b0a', overflow: 'hidden' },
  gifSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  klipy: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 6, textAlign: 'right', fontSize: 11, color: 'rgba(142,139,133,0.7)' },
  compose: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16 },
  composeInput: { minHeight: 96, color: colors.paper, fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
  toolbar: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tool: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  gifTool: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted, borderWidth: 1.5, borderColor: colors.muted, borderRadius: 4, paddingHorizontal: 3 },
  post: { borderRadius: 999, backgroundColor: colors.paper, paddingHorizontal: 18, paddingVertical: 9, minWidth: 112, alignItems: 'center' },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  tileError: { position: 'absolute', bottom: 6, left: 6, right: 6, fontSize: 11, color: '#fecaca' },
  review: { paddingVertical: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
})
