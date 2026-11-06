import { FontAwesome, FontAwesome5, Feather } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState, type ReactNode } from 'react'
import { PixelRatio, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native'
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler'
import Animated, {
  FadeIn,
  FadeOutUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { getArtistLogo } from '@/lib/api'
import { colors, display, fonts, spring } from './theme'

// Type is set in fixed sizes like the site's. A smaller system font size would shrink every heading out of its
// layout, so text only scales up (for people who need it larger), never down.
export const scalesUp = PixelRatio.getFontScale() >= 1
export const T = ({ style, ...props }: TextProps) => (
  <Text allowFontScaling={scalesUp} maxFontSizeMultiplier={1.4} {...props} style={[{ fontFamily: fonts.regular, color: colors.paper, fontSize: 15 }, style]} />
)
export const Muted = ({ style, ...props }: Parameters<typeof T>[0]) => <T {...props} style={[{ color: colors.muted, fontSize: 14 }, style]} />
export const Display = ({ size = 34, style, ...props }: Parameters<typeof T>[0] & { size?: number }) => <T maxFontSizeMultiplier={1.15} {...props} style={[display(size), style]} />

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Every tappable thing gives a little under the finger, the touch version of the web's whileTap={{ scale: 0.92 }}.
// `pressed` lets a parent hang its own animation on the press (album cards pull their record up with it).
export const Press = ({ style, scaleTo = 0.96, pressed, children, ...props }: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; pressed?: SharedValue<number>; children?: ReactNode }) => {
  const down = useSharedValue(0)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(down.value, [0, 1], [1, scaleTo]) }] }))
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        down.value = withSpring(1, spring)
        if (pressed) pressed.value = withSpring(1, spring)
        props.onPressIn?.(event)
      }}
      onPressOut={(event) => {
        down.value = withSpring(0, spring)
        if (pressed) pressed.value = withSpring(0, spring)
        props.onPressOut?.(event)
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  )
}

// The web's .skeleton sweep: a soft highlight that crosses, then rests, then crosses again.
export const Skeleton = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const sweep = useSharedValue(0)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1600 }), -1, false)
  }, [sweep])
  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(sweep.value, [0, 1], [-width, width * 2]) }] }))
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[{ backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', borderRadius: 999 }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { width }, shine]}>
        <LinearGradient colors={['transparent', 'rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  )
}

// `stretch` runs the pill full width with the count pushed to the end (the web's Listen Later chip).
export const Pill = ({ label, onPress, active = false, icon, trailing, disabled, stretch = false, style }: { label: string; onPress?: () => void; active?: boolean; icon?: keyof typeof Feather.glyphMap; trailing?: string | number; disabled?: boolean; stretch?: boolean; style?: StyleProp<ViewStyle> }) => (
  <Press onPress={onPress} disabled={disabled} style={[styles.pill, active && styles.pillActive, disabled && { opacity: 0.5 }, style]}>
    {icon ? <Feather name={icon} size={14} color={active ? '#000' : colors.paper} /> : null}
    <T numberOfLines={1} style={{ fontSize: 13, color: active ? '#000' : 'rgba(238,234,227,0.85)', flexShrink: 1, flex: stretch ? 1 : undefined }}>{label}</T>
    {trailing != null ? <T style={{ fontSize: 12, color: active ? 'rgba(0,0,0,0.6)' : colors.muted }}>{trailing}</T> : null}
  </Press>
)

export const PrimaryButton = ({ label, onPress, icon, disabled }: { label: string; onPress?: () => void; icon?: keyof typeof Feather.glyphMap; disabled?: boolean }) => (
  <Press onPress={onPress} disabled={disabled} style={[styles.primary, disabled && { opacity: 0.5 }]}>
    <T style={{ color: '#000', fontFamily: fonts.semibold, fontSize: 14 }}>{label}</T>
    {icon ? <Feather name={icon} size={15} color="#000" /> : null}
  </Press>
)

export const SectionHeading = ({ title, note }: { title: string; note?: string }) => (
  <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingBottom: 14 }}>
    <Display size={26}>{title}</Display>
    {note ? <Muted style={{ marginTop: 6 }}>{note}</Muted> : null}
  </View>
)

export const Avatar = ({ person, size = 40 }: { person?: { image?: string | null; username?: string | null; name?: string | null }; size?: number }) =>
  person?.image ? (
    <Image source={person.image} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ fontFamily: fonts.semibold, color: 'rgba(238,234,227,0.6)', fontSize: size * 0.36 }}>
        {(person?.username ?? person?.name ?? '?').charAt(0).toUpperCase()}
      </T>
    </View>
  )

// The artist's wordmark in place of their name, for a single artist. The web repaints logos for dark heroes;
// tinting to paper does the same job here. The name shows until the logo loads, and stays if there is none.
export const ArtistName = ({ artists = [], style, logoHeight = 40 }: { artists?: string[]; style?: StyleProp<TextStyle>; logoHeight?: number }) => {
  const solo = artists.length === 1 ? artists[0] : null
  const { data: logo } = useQuery({
    queryKey: ['artist-logo', solo],
    queryFn: () => getArtistLogo(solo!),
    enabled: Boolean(solo),
    staleTime: Infinity,
    retry: false,
  })
  const [ratio, setRatio] = useState<number | null>(null)
  if (logo && ratio) {
    return (
      <Animated.View entering={FadeIn.duration(500)}>
        <Image source={logo} tintColor={colors.paper} contentFit="contain" contentPosition="left" style={{ height: logoHeight, width: Math.min(logoHeight * ratio, 280) }} />
      </Animated.View>
    )
  }
  return (
    <>
      <T style={style}>{artists.join(', ')}</T>
      {logo ? <Image source={logo} style={{ width: 1, height: 1, opacity: 0, position: 'absolute' }} onLoad={(event) => setRatio(event.source.width / event.source.height)} /> : null}
    </>
  )
}

// Half-star rating. Tap a star's left or right half, or drag across the row like a slider; each half-step ticks
// a haptic. Like the web, the filled star springs, a ring bursts from it, and "Recorded" floats up.
const STAR = 34
export const RatingStars = ({ value = 0, onRate, readOnly = false, size = STAR }: { value?: number; onRate?: (value: number) => void; readOnly?: boolean; size?: number }) => {
  const [preview, setPreview] = useState<number | null>(null)
  const [toast, setToast] = useState<{ key: number; label: string } | null>(null)
  const shown = preview ?? value
  const width = size * 5

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 1500)
    return () => clearTimeout(timer)
  }, [toast])

  const toValue = (x: number) => Math.min(5, Math.max(0.5, Math.ceil((x / width) * 10) / 2))
  const tick = (next: number) => {
    setPreview((current) => {
      if (current !== next) void Haptics.selectionAsync()
      return next
    })
  }
  const commit = (next: number) => {
    setPreview(null)
    setToast({ key: Date.now(), label: Math.abs(next - value) < 0.001 ? 'Cleared' : 'Recorded' })
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onRate?.(next)
  }

  // runOnJS: the callbacks only set React state, so they skip the UI-thread hop.
  const pan = usePanGesture({
    enabled: !readOnly,
    runOnJS: true,
    activeOffsetX: [-6, 6],
    onUpdate: (event) => tick(toValue(event.x)),
    onDeactivate: (event) => (event.canceled ? setPreview(null) : commit(toValue(event.x))),
  })
  const tap = useTapGesture({
    enabled: !readOnly,
    runOnJS: true,
    onDeactivate: (event) => { if (!event.canceled) commit(toValue(event.x)) },
  })
  const gesture = useCompetingGestures(pan, tap)

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View style={{ flexDirection: 'row', width }} hitSlop={8} accessibilityRole="adjustable" accessibilityLabel={`Rating ${value} of 5`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} size={size} fill={Math.min(Math.max(shown - (star - 1), 0), 1)} burst={toast && Math.ceil(value) === star ? toast.key : 0} />
          ))}
        </View>
      </GestureDetector>
      {toast ? (
        <Animated.View key={toast.key} entering={FadeIn.duration(200)} exiting={FadeOutUp.duration(400)} style={styles.toast} pointerEvents="none">
          <T style={{ fontFamily: fonts.bold, fontSize: 12 }}>{toast.label}</T>
        </Animated.View>
      ) : null}
    </View>
  )
}

const Star = ({ size, fill, burst }: { size: number; fill: number; burst: number }) => {
  const fillWidth = useSharedValue(fill)
  const pop = useSharedValue(1)
  const ring = useSharedValue(0)
  useEffect(() => {
    fillWidth.value = withSpring(fill, { damping: 20, stiffness: 320 })
  }, [fill, fillWidth])
  useEffect(() => {
    if (!burst) return
    pop.value = withSequence(withTiming(1.25, { duration: 120 }), withSpring(1, { damping: 8, stiffness: 300 }))
    ring.value = 0
    ring.value = withTiming(1, { duration: 600 })
  }, [burst, pop, ring])
  const icon = size * 0.62
  const clip = useAnimatedStyle(() => ({ width: icon * fillWidth.value }))
  const scale = useAnimatedStyle(() => ({ transform: [{ scale: pop.value * (fillWidth.value > 0 ? 1.04 : 1) }] }))
  const ringStyle = useAnimatedStyle(() => ({ opacity: burst ? 0.8 * (1 - ring.value) : 0, transform: [{ scale: 0.5 + ring.value * 2 }] }))
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: icon, height: icon, borderRadius: icon, backgroundColor: 'rgba(255,255,255,0.3)' }, ringStyle]} />
      <Animated.View style={scale}>
        <FontAwesome name="star" size={icon} color="rgba(142,139,133,0.4)" />
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' }, clip]}>
          <FontAwesome name="star" size={icon} color="#fff" />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

export const StarValue = ({ value, color = 'rgba(238,234,227,0.85)' }: { value: number; color?: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <FontAwesome name="star" size={10} color={color} />
    <T style={{ fontSize: 12, fontFamily: fonts.medium, color }}>{value.toFixed(1)}</T>
  </View>
)

// Simple Icons has no Amazon Music mark on the web either, so Amazon's smile stands in, in Amazon Music's teal.
const PLATFORMS = [
  { key: 'spotify', label: 'Spotify', icon: 'spotify', color: '#1ED760' },
  { key: 'appleMusic', label: 'Apple Music', icon: 'apple', color: '#FA2D48' },
  { key: 'youtubeMusic', label: 'YouTube Music', icon: 'youtube', color: '#FF0033' },
  { key: 'amazonMusic', label: 'Amazon Music', icon: 'amazon', color: '#25D1DA' },
] as const

// Phones on the web: the label on its own line over an even 2x2 grid. Links open in an in-app browser sheet.
export const StreamingLinks = ({ links }: { links: Record<string, string> }) => (
  <View>
    <Muted style={{ marginBottom: 8 }}>Listen on</Muted>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {PLATFORMS.map((platform) => (
        <Press
          key={platform.key}
          onPress={() => links[platform.key] && WebBrowser.openBrowserAsync(links[platform.key])}
          disabled={!links[platform.key]}
          style={[styles.platform, !links[platform.key] && { opacity: 0.4 }]}
        >
          <FontAwesome5 name={platform.icon} brand size={15} color={platform.color} />
          <T numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>{platform.label}</T>
          <Feather name="arrow-up-right" size={13} color={colors.muted} />
        </Press>
      ))}
    </View>
  </View>
)

export const EmptyNote = ({ children, dashed = true, align = 'center' }: { children: ReactNode; dashed?: boolean; align?: 'center' | 'left' }) => (
  <View style={[styles.empty, dashed && { borderStyle: 'dashed' }, align === 'left' && { paddingVertical: 24 }]}>
    <Muted style={{ textAlign: align }}>{children}</Muted>
  </View>
)

// The web's inputs: a soft glass box that brightens while focused.
export const Field = ({ label, ...props }: TextInputProps & { label: string }) => {
  const focus = useSharedValue(0)
  const box = useAnimatedStyle(() => ({
    borderColor: withTiming(focus.value ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)', { duration: 200 }),
    backgroundColor: withTiming(focus.value ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)', { duration: 200 }),
  }))
  return (
    <View>
      <Muted style={{ marginBottom: 6 }}>{label}</Muted>
      <Animated.View style={[fieldStyles.box, box]}>
        <TextInput
          allowFontScaling={scalesUp}
          placeholderTextColor="rgba(142,139,133,0.7)"
          style={fieldStyles.input}
          autoCapitalize="none"
          {...props}
          onFocus={(event) => {
            focus.value = 1
            props.onFocus?.(event)
          }}
          onBlur={(event) => {
            focus.value = 0
            props.onBlur?.(event)
          }}
        />
      </Animated.View>
    </View>
  )
}


const fieldStyles = StyleSheet.create({
  box: { borderRadius: 16, borderWidth: 1 },
  input: { paddingHorizontal: 16, paddingVertical: 14, color: colors.paper, fontFamily: fonts.regular, fontSize: 16 },
})

export const formatTimeAgo = (timestamp: number | string) => {
  const date = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp)
  if (!Number.isFinite(date)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.wash,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  pillActive: { backgroundColor: colors.paper, borderColor: colors.paper, shadowColor: colors.paper, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colors.paper, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 13 },
  toast: { position: 'absolute', top: -22, left: 0 },
  platform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    width: '48.5%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  empty: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 18, paddingHorizontal: 20, paddingVertical: 32 },
})
