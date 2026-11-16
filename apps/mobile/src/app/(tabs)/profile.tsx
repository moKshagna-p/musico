import { Feather } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { authClient, fetchDashboard, fetchFollowers, fetchFollowing, updateProfile } from '@/lib/api'
import { useAuth } from '@/lib/state'
import { cleanUsername, STATUS_TEXT, useUsernameStatus } from '@/lib/username'
import { enter, ListCard, openAlbum } from '@/ui/album'
import { ListeningDiary, RatingSpread, Stats, TopGenres } from '@/ui/insights'
import { Display, EmptyNote, Muted, Press, SectionHeading, Skeleton, T, scalesUp } from '@/ui/kit'
import { GhostButton, PeopleSheet, ProfileHeader, Sheet } from '@/ui/profile'
import { Screen } from '@/ui/Screen'
import { colors, fonts } from '@/ui/theme'

const shortDate = (timestamp: number) => (timestamp ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(timestamp) : '')

// Picked photos go up as data URLs, like the web; a banner only needs ~1600px across, an avatar much less,
// which keeps both well under the API's 2MB cap.
const pickImage = async (maxWidth: number) => {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
  if (result.canceled) return null
  const asset = result.assets[0]
  const scale = Math.min(1, maxWidth / asset.width)
  const image = await ImageManipulator.manipulate(asset.uri).resize({ width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) }).renderAsync()
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true })
  return `data:image/jpeg;base64,${saved.base64}`
}

export default function MyProfile() {
  const queryClient = useQueryClient()
  const { user, isPending } = useAuth()
  const dashboard = useQuery({ queryKey: ['dashboard', user?.id ?? null], queryFn: fetchDashboard, enabled: !isPending && Boolean(user?.id) })
  const [sheet, setSheet] = useState<'edit' | 'followers' | 'following' | 'username' | null>(null)

  useEffect(() => {
    if (!isPending && !user) router.replace('/auth')
  }, [isPending, user])

  const profile = dashboard.data?.profile
  useEffect(() => {
    if (dashboard.data && !profile?.username) setSheet('username')
  }, [dashboard.data, profile?.username])

  const ratedItems = useMemo(
    () =>
      Object.entries((dashboard.data?.ratings ?? {}) as Record<string, { rating: number; timestamp: number }>)
        .map(([albumId, value]) => ({ albumId, rating: Number(value?.rating ?? 0), timestamp: Number(value?.timestamp ?? 0) }))
        .filter((entry) => entry.rating > 0)
        .sort((a, b) => b.timestamp - a.timestamp),
    [dashboard.data?.ratings],
  )
  const recent = useMemo(
    () =>
      ((dashboard.data?.recentRatings ?? []) as any[])
        .map((item) => ({
          albumId: String(item?.albumId ?? ''),
          rating: Number(item?.rating ?? 0),
          timestamp: Number(item?.timestamp ?? 0),
          name: String(item?.albumName ?? '').trim(),
          cover: String(item?.albumCover ?? '').trim(),
          artists: Array.isArray(item?.albumArtists) ? item.albumArtists.filter(Boolean).map(String) : [],
          genres: Array.isArray(item?.genres) ? item.genres.filter(Boolean).map(String) : [],
        }))
        .filter((item) => item.albumId && item.rating > 0),
    [dashboard.data?.recentRatings],
  )

  if (isPending || !user || dashboard.isLoading) {
    return (
      <Screen footer={false}>
        <View style={{ paddingTop: 16 }}>
          <Skeleton style={{ width: 96, height: 96 }} />
          <Skeleton style={{ marginTop: 24, height: 44, width: '70%', borderRadius: 12 }} />
          <Skeleton style={{ marginTop: 14, height: 14, width: 100 }} />
          <Skeleton style={{ marginTop: 18, height: 14, width: 180 }} />
        </View>
      </Screen>
    )
  }

  const totalRated = Number(dashboard.data?.ratingSummary?.totalRated ?? ratedItems.length)
  const averageRating = Number(dashboard.data?.ratingSummary?.averageRating ?? 0)
  const signOut = async () => {
    await authClient.signOut()
    queryClient.clear()
    router.replace('/auth')
  }

  return (
    <Screen refreshing={dashboard.isRefetching} onRefresh={() => void dashboard.refetch()}>
      <ProfileHeader
        person={{ ...profile, name: user.name || user.email }}
        onFollowers={() => setSheet('followers')}
        onFollowing={() => setSheet('following')}
        actions={
          <>
            {!profile?.username ? <GhostButton solid label="Set Username" onPress={() => setSheet('username')} /> : null}
            <GhostButton label="Edit Profile" icon="edit-2" onPress={() => setSheet('edit')} disabled={!profile} />
            <GhostButton label="Sign Out" icon="log-out" onPress={signOut} />
          </>
        }
      />

      <View style={{ marginTop: 40 }}>
        <Stats recent={recent} totalRated={totalRated} averageRating={averageRating} />
        <TopGenres recent={recent} />
        <RatingSpread ratings={ratedItems} averageRating={averageRating} />

        <View style={{ marginTop: 24 }}>
          <SectionHeading title="Recently Rated" note="The last records you scored." />
          <Muted style={{ marginTop: 12, color: colors.paper }} onPress={() => router.push('/profile/history')}>View Full History →</Muted>
          {recent.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={196} decelerationRate="fast" style={{ marginTop: 24, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
              {recent.map((album, index) => (
                <Animated.View key={album.albumId} entering={enter(index)} style={{ width: 180 }}>
                  <Press onPress={() => openAlbum({ id: album.albumId, name: album.name, cover: album.cover, artists: album.artists })} scaleTo={0.97}>
                    <View style={styles.recentCover}>
                      {album.cover ? <Image source={album.cover} style={StyleSheet.absoluteFill} transition={250} /> : null}
                      <T style={styles.recentScore}>{album.rating.toFixed(1)}</T>
                    </View>
                    <T numberOfLines={1} style={{ marginTop: 12, fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.6 }}>{album.name || 'Untitled album'}</T>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Muted numberOfLines={1} style={{ flex: 1 }}>{album.artists[0] ?? 'Unknown artist'}</Muted>
                      <Muted style={{ fontSize: 12 }}>{shortDate(album.timestamp)}</Muted>
                    </View>
                  </Press>
                </Animated.View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ marginTop: 24 }}>
              <EmptyNote>
                Nothing rated yet. <Muted style={{ color: colors.paper, textDecorationLine: 'underline' }} onPress={() => router.navigate('/discover')}>Find an album</Muted> and give it some stars.
              </EmptyNote>
            </View>
          )}
        </View>

        <ListeningDiary ratings={ratedItems} />

        <View style={{ marginTop: 96 }}>
          <SectionHeading title="Your Collections" note="Lists you've built, newest first." />
          <View style={{ marginTop: 32, gap: 24 }}>
            {dashboard.data?.lists?.length ? dashboard.data.lists.map((list: any, index: number) => <ListCard key={list.id} list={list} index={index} />) : <EmptyNote>No lists created yet.</EmptyNote>}
          </View>
        </View>
      </View>

      <FollowSheets which={sheet} onClose={() => setSheet(null)} />
      <EditProfileSheet visible={sheet === 'edit'} profile={profile} fallbackInitial={(user.name || user.email || '?').charAt(0)} onClose={() => setSheet(null)} onSaved={() => queryClient.invalidateQueries({ queryKey: ['dashboard', user.id] })} />
      <UsernameSheet visible={sheet === 'username'} onClose={() => setSheet(null)} onSaved={() => queryClient.invalidateQueries({ queryKey: ['dashboard', user.id] })} />
    </Screen>
  )
}

const FollowSheets = ({ which, onClose }: { which: string | null; onClose: () => void }) => {
  const followers = useQuery({ queryKey: ['my-followers'], queryFn: fetchFollowers, enabled: which === 'followers' })
  const following = useQuery({ queryKey: ['my-following'], queryFn: fetchFollowing, enabled: which === 'following' })
  return (
    <>
      <PeopleSheet title="Followers" visible={which === 'followers'} people={followers.data ?? []} loading={followers.isLoading} onClose={onClose} />
      <PeopleSheet title="Following" visible={which === 'following'} people={following.data ?? []} loading={following.isLoading} onClose={onClose} />
    </>
  )
}

const EditProfileSheet = ({ visible, profile, fallbackInitial, onClose, onSaved }: { visible: boolean; profile: any; fallbackInitial: string; onClose: () => void; onSaved: () => Promise<unknown> }) => {
  const [bio, setBio] = useState('')
  const [image, setImage] = useState('')
  const [cover, setCover] = useState('')
  const [coverChanged, setCoverChanged] = useState(false)
  const [busy, setBusy] = useState<'image' | 'cover' | 'save' | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!visible) return
    setBio(profile?.bio ?? '')
    setImage(profile?.image ?? '')
    setCover(profile?.cover ?? '')
    setCoverChanged(false)
    setStatus('')
  }, [visible, profile])

  const choose = async (kind: 'image' | 'cover') => {
    setBusy(kind)
    setStatus('')
    try {
      const picked = await pickImage(kind === 'cover' ? 1600 : 512)
      if (!picked) return
      if (kind === 'image') setImage(picked)
      else {
        setCover(picked)
        setCoverChanged(true)
      }
    } catch {
      setStatus('Unable to read that image.')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    setBusy('save')
    setStatus('')
    try {
      await updateProfile({ bio: bio.trim(), image: image.trim(), cover: coverChanged ? cover : undefined })
      await onSaved()
      setStatus('Saved.')
      setTimeout(onClose, 600)
    } catch (error) {
      setStatus((error as Error).message ?? 'Failed to update profile.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet visible={visible} title="Edit Profile" note="Update your bio, profile picture, and cover." onClose={onClose}>
      <View style={{ gap: 20 }}>
        {profile?.username ? (
          <View>
            <Muted>Username</Muted>
            <T style={{ marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>@{profile.username}</T>
          </View>
        ) : null}
        <View>
          <Muted>Bio</Muted>
          <TextInput allowFontScaling={scalesUp} value={bio} onChangeText={(value) => setBio(value.slice(0, 160))} placeholder="Tell people about yourself..." placeholderTextColor="rgba(142,139,133,0.5)" multiline style={styles.bio} />
          <Muted style={{ marginTop: 4, textAlign: 'right', fontSize: 12, color: 'rgba(142,139,133,0.6)' }}>{bio.length}/160</Muted>
        </View>
        <View>
          <Muted>Profile Picture</Muted>
          <View style={[styles.box, { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }]}>
            {image ? <Image source={image} style={styles.editAvatar} /> : <View style={[styles.editAvatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(35,34,32,0.6)' }]}><T style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 18 }}>{fallbackInitial.toUpperCase()}</T></View>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 }}>
              <GhostButton label={busy === 'image' ? 'Preparing…' : 'Upload'} icon="upload" onPress={() => choose('image')} disabled={Boolean(busy)} />
              {image ? <GhostButton label="Remove" onPress={() => setImage('')} /> : null}
            </View>
          </View>
        </View>
        <View>
          <Muted>Cover</Muted>
          <View style={[styles.box, { overflow: 'hidden' }]}>
            {cover ? <Image source={cover} style={{ aspectRatio: 2, width: '100%' }} contentFit="cover" /> : <View style={{ aspectRatio: 2, width: '100%', backgroundColor: 'rgba(255,255,255,0.03)' }} />}
            <View style={{ flexDirection: 'row', gap: 8, padding: 16 }}>
              <GhostButton label={busy === 'cover' ? 'Preparing cover…' : 'Upload Cover'} icon="upload" onPress={() => choose('cover')} disabled={Boolean(busy)} />
              {cover ? <GhostButton label="Remove" onPress={() => { setCover(''); setCoverChanged(true) }} /> : null}
            </View>
          </View>
        </View>
        {status ? <Animated.View entering={FadeIn}><T style={{ fontSize: 12, color: status === 'Saved.' ? '#4ade80' : '#f87171' }}>{status}</T></Animated.View> : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={save} disabled={Boolean(busy)} style={[styles.save, busy && { opacity: 0.4 }]}>
            {busy === 'save' ? <ActivityIndicator color="#000" /> : <T style={{ color: '#000', fontFamily: fonts.medium, fontSize: 14 }}>Save Changes</T>}
          </Pressable>
          <GhostButton label="Cancel" onPress={onClose} />
        </View>
      </View>
    </Sheet>
  )
}

const UsernameSheet = ({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => Promise<unknown> }) => {
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { status, retry } = useUsernameStatus(username)
  const save = async () => {
    if (status !== 'available' || saving) return
    setSaving(true)
    setError('')
    try {
      await updateProfile({ username })
      await onSaved()
      onClose()
    } catch (caught) {
      setError((caught as Error).message ?? 'Failed to set username.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Sheet visible={visible} title="Choose your username" note="This helps other users find and follow you. You can change it later." onClose={onClose}>
      <Muted>Username</Muted>
      <View style={[styles.usernameBox]}>
        <T style={{ color: colors.muted }}>@</T>
        <TextInput allowFontScaling={scalesUp} autoFocus value={username} onChangeText={(value) => setUsername(cleanUsername(value))} placeholder="yourname" placeholderTextColor="rgba(142,139,133,0.6)" autoCapitalize="none" autoCorrect={false} maxLength={24} onSubmitEditing={save} style={{ flex: 1, color: '#fff', fontFamily: fonts.regular, fontSize: 16, paddingVertical: 12 }} />
        {status === 'available' ? <Feather name="check" size={16} color="#4ade80" /> : status === 'taken' || status === 'invalid' ? <Feather name="x" size={16} color="#f87171" /> : null}
      </View>
      {status ? (
        <T style={{ marginTop: 6, fontSize: 12, color: status === 'available' ? '#4ade80' : status === 'checking' ? colors.muted : '#f87171' }}>
          {STATUS_TEXT[status]}
          {status === 'error' ? <T style={{ fontSize: 12, textDecorationLine: 'underline', color: '#f87171' }} onPress={retry}>  Retry username check</T> : null}
        </T>
      ) : null}
      {status === 'available' ? <Muted style={{ marginTop: 4, fontSize: 12 }}>Findable as @{username}</Muted> : null}
      {error ? <T style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>{error}</T> : null}
      <View style={{ marginTop: 20, flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={save} disabled={status !== 'available' || saving} style={[styles.save, (status !== 'available' || saving) && { opacity: 0.4 }]}>
          {saving ? <ActivityIndicator color="#000" /> : <T style={{ color: '#000', fontFamily: fonts.medium, fontSize: 14 }}>Set Username</T>}
        </Pressable>
        <GhostButton label="Skip" onPress={onClose} />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  recentCover: { width: 180, height: 180, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.panel },
  recentScore: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, overflow: 'hidden' },
  bio: { marginTop: 8, minHeight: 84, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, color: '#fff', fontFamily: fonts.regular, fontSize: 14, textAlignVertical: 'top' },
  box: { marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(35,34,32,0.6)', backgroundColor: 'rgba(0,0,0,0.3)' },
  editAvatar: { width: 64, height: 64, borderRadius: 32 },
  save: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.paper, paddingVertical: 12 },
  usernameBox: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 14 },
})
