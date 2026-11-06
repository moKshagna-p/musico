import { Feather } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Fragment, useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated'

import { toggleFollow } from '@/lib/api'
import { openAlbum } from './album'
import { Avatar, formatTimeAgo, Muted, Press, T } from './kit'
import { colors, fonts } from './theme'

const openProfile = (username?: string | null) => username && router.push({ pathname: '/user/[username]', params: { username } })

export const PersonName = ({ person }: { person?: any }) => (
  <T onPress={person?.username ? () => openProfile(person.username) : undefined} style={{ fontFamily: fonts.medium }}>
    {person?.username ?? person?.name ?? 'Unknown'}
  </T>
)

// Long sittings show a few albums and fold the rest behind a button, so one busy person can't flood the feed.
const VISIBLE_ALBUMS = 3

// One feed card: a person, when, and everything they did in that sitting (groupFeed, shared with the web).
export const ActivityCard = ({ group, index }: { group: any; index: number }) => {
  const [expanded, setExpanded] = useState(false)
  const { user: actor, albums, follows, createdAt } = group
  const folds = albums.length > VISIBLE_ALBUMS + 1 && !expanded
  const shown = folds ? albums.slice(0, VISIBLE_ALBUMS) : albums
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 60).duration(450)} layout={LinearTransition} style={styles.card}>
      <Pressable onPress={() => openProfile(actor?.username)}><Avatar person={actor} /></Pressable>
      <View style={{ flex: 1, paddingTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <PersonName person={actor} />
          <Muted style={{ fontSize: 12, color: 'rgba(142,139,133,0.7)' }}>{formatTimeAgo(createdAt)}</Muted>
        </View>
        {shown.map((album: any) => <AlbumEntry key={album.albumId} album={album} />)}
        {folds ? (
          <Press onPress={() => setExpanded(true)} style={styles.more}>
            <Muted style={{ fontSize: 12 }}>Show {albums.length - VISIBLE_ALBUMS} more</Muted>
          </Press>
        ) : null}
        {follows.length ? (
          <Muted style={{ marginTop: albums.length ? 12 : 4 }}>
            Started following{' '}
            {follows.map((person: any, i: number) => (
              <Fragment key={person.username ?? i}>
                {i > 0 ? (i === follows.length - 1 ? ' and ' : ', ') : ''}
                <PersonName person={person} />
              </Fragment>
            ))}
          </Muted>
        ) : null}
      </View>
    </Animated.View>
  )
}

// Everything done to one album in a sitting, on one line: stars, review, and list adds.
const AlbumEntry = ({ album }: { album: any }) => {
  const actions: string[] = [
    album.rating > 0 ? `${'★'.repeat(Math.floor(album.rating))}${album.rating % 1 ? '½' : ''}` : '',
    album.reviewed ? 'Reviewed' : '',
    ...album.lists.map((list: any) => `Added to ${list.listName ?? 'a list'}`),
  ].filter(Boolean)
  return (
    <Press onPress={() => openAlbum({ id: album.albumId, name: album.albumName, cover: album.albumCover })} scaleTo={0.98} style={{ marginTop: 12, flexDirection: 'row', gap: 12 }}>
      <View style={styles.cover}>{album.albumCover ? <Image source={album.albumCover} style={StyleSheet.absoluteFill} transition={250} /> : null}</View>
      <View style={{ flex: 1 }}>
        <T numberOfLines={1} style={{ fontFamily: fonts.medium }}>{album.albumName || 'Untitled album'}</T>
        <Muted style={{ marginTop: 3 }}>
          {actions.map((action, i) => (
            <Fragment key={i}>
              {i > 0 ? <Muted style={{ color: 'rgba(142,139,133,0.4)' }}> · </Muted> : null}
              <Muted style={action.startsWith('★') ? { color: colors.paper, letterSpacing: 2 } : undefined}>{action}</Muted>
            </Fragment>
          ))}
        </Muted>
        {album.snippet ? (
          <T numberOfLines={3} style={styles.snippet}>“{album.snippet}”</T>
        ) : null}
      </View>
    </Press>
  )
}

export const FollowButton = ({ username, initialFollowing = false }: { username: string; initialFollowing?: boolean }) => {
  const queryClient = useQueryClient()
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)
  useEffect(() => setFollowing(initialFollowing), [initialFollowing])
  const press = async () => {
    if (loading) return
    setLoading(true)
    const previous = following
    setFollowing(!previous)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      setFollowing((await toggleFollow(username)).following)
      void queryClient.invalidateQueries({ queryKey: ['user-profile', username.toLowerCase()] })
    } catch {
      setFollowing(previous)
    } finally {
      setLoading(false)
    }
  }
  return (
    <Press onPress={press} style={[styles.follow, following ? styles.following : styles.notFollowing]}>
      {following ? <Animated.View entering={ZoomIn.springify()}><Feather name="check" size={14} color={colors.paper} /></Animated.View> : null}
      <Animated.View key={String(following)} entering={FadeIn}>
        <T style={{ fontSize: 13, fontFamily: fonts.medium, color: following ? colors.paper : '#000' }}>{following ? 'Following' : 'Follow'}</T>
      </Animated.View>
    </Press>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 14, paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  cover: { width: 52, height: 52, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.panel },
  more: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 6 },
  snippet: { marginTop: 8, borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingLeft: 12, fontSize: 14, fontStyle: 'italic', lineHeight: 21, color: 'rgba(238,234,227,0.8)' },
  follow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1 },
  following: { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)' },
  notFollowing: { borderColor: colors.paper, backgroundColor: colors.paper },
})
