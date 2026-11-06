import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import Animated, { Extrapolation, FadeIn, FadeInDown, interpolate, useAnimatedStyle, Keyframe } from 'react-native-reanimated'

import { Avatar, Display, Muted, T } from './kit'
import { usePageScroll } from './scroll'
import { colors, display, easeOut, fonts, GUTTER } from './theme'
import { VinylDisc } from './vinyl'

export type Person = { name?: string; username?: string | null; bio?: string | null; image?: string | null; cover?: string | null; followerCount?: number; followingCount?: number }

// Edge-to-edge backdrop behind the header that fades into the page, like the album Billboard. It settles in on load
// and drifts at a third of the scroll speed for depth (the web's ProfileCover).
const ProfileCover = ({ src }: { src: string }) => {
  const { scrollY } = usePageScroll()
  const drift = useAnimatedStyle(() => ({
    transform: [
      { translateY: scrollY.value < 0 ? scrollY.value : scrollY.value / 3 },
      { scale: interpolate(scrollY.value, [-200, 0], [1.4, 1], Extrapolation.CLAMP) },
    ],
  }))
  return (
    <View pointerEvents="none" style={styles.cover}>
      <Animated.View entering={FadeIn.duration(1100)} style={[StyleSheet.absoluteFill, drift]}>
        <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
      <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 }} />
      <LinearGradient colors={['transparent', colors.canvas]} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }} />
    </View>
  )
}

// The web's avatarPop keyframes: in from small and tilted, a little overshoot, settle.
const avatarPop = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }, { rotate: '-12deg' }] },
  60: { opacity: 1, transform: [{ scale: 1.06 }, { rotate: '2deg' }], easing: easeOut },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
}).duration(700)

// Name, handle, bio and counts, with the avatar landing on a small overshoot.
export const ProfileHeader = ({ person, onFollowers, onFollowing, actions }: { person: Person; onFollowers?: () => void; onFollowing?: () => void; actions?: ReactNode }) => (
  <View>
    {person.cover ? <ProfileCover src={person.cover} /> : null}
    <View style={{ paddingTop: person.cover ? 120 : 16 }}>
      <Animated.View entering={avatarPop}>
        {person.image ? (
          <Image source={person.image} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <VinylDisc size={96} />
            <View style={styles.initial}><T style={[display(24), { color: '#000' }]}>{person.name?.charAt(0)?.toUpperCase() ?? '?'}</T></View>
          </View>
        )}
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(120).duration(500).easing(easeOut)}>
        <Display size={48} style={{ marginTop: 24 }}>{person.name}</Display>
        {person.username ? <Muted style={{ marginTop: 12 }}>@{person.username}</Muted> : null}
        {person.bio ? <T style={{ marginTop: 12, color: 'rgba(238,234,227,0.75)' }}>{person.bio}</T> : null}
        <View style={{ marginTop: 16, flexDirection: 'row', gap: 20 }}>
          <Muted onPress={onFollowers}><T style={{ fontSize: 14, fontFamily: fonts.medium }}>{person.followerCount ?? 0}</T> followers</Muted>
          <Muted onPress={onFollowing}><T style={{ fontSize: 14, fontFamily: fonts.medium }}>{person.followingCount ?? 0}</T> following</Muted>
        </View>
        {actions ? <View style={{ marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{actions}</View> : null}
      </Animated.View>
    </View>
  </View>
)

// The web's modals: a dark glass panel over a blurred, dimmed page. It springs up from below and stays clear of the keyboard.
export const Sheet = ({ visible, title, note, onClose, children }: { visible: boolean; title: string; note?: string; onClose: () => void; children: ReactNode }) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Animated.View entering={FadeInDown.springify().damping(20).stiffness(180)} style={styles.sheet}>
          <Pressable onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24 }} style={{ maxHeight: 640 }}>
              <Pressable onPress={onClose} hitSlop={10} style={{ position: 'absolute', right: 16, top: 16, zIndex: 1 }} accessibilityLabel="Close">
                <Feather name="x" size={20} color={colors.muted} />
              </Pressable>
              <Display size={30}>{title}</Display>
              {note ? <Muted style={{ marginTop: 4 }}>{note}</Muted> : null}
              <View style={{ marginTop: 20 }}>{children}</View>
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </KeyboardAvoidingView>
  </Modal>
)

export const PeopleSheet = ({ title, people, loading, visible, onClose }: { title: string; people: any[]; loading: boolean; visible: boolean; onClose: () => void }) => (
  <Sheet visible={visible} title={title} onClose={onClose}>
    {loading ? (
      <ActivityIndicator color={colors.paper} style={{ marginVertical: 24 }} />
    ) : people.length ? (
      <View style={{ gap: 10 }}>
        {people.map((person, index) => (
          <Animated.View key={person.id ?? index} entering={FadeInDown.delay(index * 40).duration(250)}>
            <Pressable
              onPress={() => {
                if (!person.username) return
                onClose()
                router.push({ pathname: '/user/[username]', params: { username: person.username } })
              }}
              style={styles.personRow}
            >
              <Avatar person={person} size={44} />
              <View style={{ flex: 1 }}>
                <T numberOfLines={1} style={{ fontSize: 14, fontFamily: fonts.semibold }}>{person.name}</T>
                {person.username ? <Muted numberOfLines={1} style={{ fontSize: 12 }}>@{person.username}</Muted> : null}
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    ) : (
      <Muted>No users here yet.</Muted>
    )}
  </Sheet>
)

// A round outline button like the web's "Edit Profile" / "Sign Out".
export const GhostButton = ({ label, icon, onPress, solid = false, disabled }: { label: string; icon?: keyof typeof Feather.glyphMap; onPress: () => void; solid?: boolean; disabled?: boolean }) => (
  <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.ghost, solid && styles.solid, disabled && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.96 }] }]}>
    {icon ? <Feather name={icon} size={14} color={solid ? '#000' : 'rgba(238,234,227,0.8)'} /> : null}
    <T style={{ fontSize: 14, color: solid ? '#000' : 'rgba(238,234,227,0.8)', fontFamily: solid ? fonts.medium : fonts.regular }}>{label}</T>
  </Pressable>
)

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: -140, left: -GUTTER, right: -GUTTER, height: 256, overflow: 'hidden' },
  avatar: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  initial: { position: 'absolute', left: '30%', top: '30%', width: '40%', height: '40%', borderRadius: 999, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(11,11,10,0.97)', shadowColor: '#000', shadowOpacity: 1, shadowRadius: 60, shadowOffset: { width: 0, height: 40 }, elevation: 30 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(35,34,32,0.6)', backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 16, paddingVertical: 12 },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, paddingVertical: 9 },
  solid: { backgroundColor: colors.paper, borderColor: colors.paper },
})
