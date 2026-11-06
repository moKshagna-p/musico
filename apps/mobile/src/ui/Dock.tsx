import { Feather } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { router, usePathname, type Href } from 'expo-router'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/lib/state'
import { T } from './kit'
import { colors, fonts } from './theme'
import { MusicoMark } from './vinyl'

type Item = { label: string; href: Href; match: (path: string) => boolean }
const HOME: Item = { label: 'Home', href: '/', match: (path) => path === '/' }
const DISCOVER: Item = { label: 'Discover', href: '/discover', match: (path) => path === '/discover' }
const FEED: Item = { label: 'Feed', href: '/feed', match: (path) => path === '/feed' }
const PROFILE: Item = { label: 'Profile', href: '/profile', match: (path) => path === '/profile' }
// Pages you can only reach by drilling in get a back button inside the pill (the web's nav-row BackButton).
const TOP_LEVEL = ['/', '/discover', '/feed', '/profile', '/auth']

const SPRING = { stiffness: 420, damping: 34 }

// The web's floating nav: a blurred pill pinned to the top with the brand record and a highlight that springs
// between links (layoutId="dock-active" there). Rendered once above every screen, like the site's header.
export const Dock = () => {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const { user } = useAuth()
  const [frames, setFrames] = useState<Record<string, LayoutRectangle>>({})
  const items = user ? [HOME, DISCOVER, FEED, PROFILE] : [HOME, DISCOVER]
  const active = items.find((item) => item.match(pathname))
  const frame = active && frames[active.label]
  const canGoBack = !TOP_LEVEL.includes(pathname)

  const highlight = useAnimatedStyle(() =>
    frame
      ? { opacity: withTiming(1, { duration: 150 }), left: withSpring(frame.x, SPRING), width: withSpring(frame.width, SPRING) }
      : { opacity: withTiming(0, { duration: 150 }) },
  )

  // The mark turns 200° on press, as it does on hover on the web.
  const spin = useSharedValue(0)
  const markStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }))

  const go = (href: Href) => {
    void Haptics.selectionAsync()
    router.navigate(href)
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 10 }]}>
      <Animated.View layout={LinearTransition.springify().damping(22)} style={styles.shadow}>
        {/* Real blur on iOS. Android blur needs a blurTarget per screen, so there the glass is a denser fill to stay legible. */}
        <BlurView intensity={40} tint="dark" style={styles.dock}>
          {canGoBack ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} hitSlop={8} accessibilityLabel="Back" style={styles.back}>
                <Feather name="arrow-left" size={17} color={colors.paper} />
              </Pressable>
              <View style={styles.divider} />
            </Animated.View>
          ) : null}
          <Pressable
            onPress={() => {
              spin.value = withSequence(withTiming(200, { duration: 700 }), withTiming(0, { duration: 0 }))
              go('/')
            }}
            accessibilityLabel="Go to Musico home"
            style={{ padding: 2 }}
          >
            <Animated.View style={markStyle}><MusicoMark size={28} /></Animated.View>
          </Pressable>
          <View style={styles.divider} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Animated.View style={[styles.highlight, highlight]} />
            {items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="link"
                accessibilityState={{ selected: active === item }}
                onLayout={(event) => {
                  const layout = event.nativeEvent.layout
                  setFrames((prev) => ({ ...prev, [item.label]: layout }))
                }}
                onPress={() => go(item.href)}
                style={styles.link}
              >
                <T style={{ fontSize: 13, color: active === item ? colors.paper : colors.muted }}>{item.label}</T>
              </Pressable>
            ))}
            {!user ? (
              <Pressable onPress={() => go('/auth')} style={styles.signIn}>
                <T style={{ fontSize: 13, fontFamily: fonts.medium, color: '#000' }}>Sign In</T>
              </Pressable>
            ) : null}
          </View>
        </BlurView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  shadow: { borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.9, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 16 },
  dock: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: Platform.OS === 'android' ? 'rgba(10,10,9,0.86)' : 'rgba(0,0,0,0.55)' },
  divider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 },
  highlight: { position: 'absolute', top: 0, bottom: 0, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  link: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  signIn: { backgroundColor: colors.paper, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginLeft: 4 },
  back: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
})
