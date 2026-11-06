import { Image } from 'expo-image'
import { useEffect, useRef, type ComponentRef, type RefObject } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { hidden, registerSource } from './morph'
import { colors, easeOut } from './theme'

const isCdArt = (url?: string | null) => /\/cdart\//.test(url ?? '')

// Grooves + sheen, drawn once in a 100x100 box. The sheen is the web's conic highlight, as two still wedges:
// only the label turns, so the light stays put like a real record under a lamp.
const GROOVES = Array.from({ length: 22 }, (_, index) => 18 + index * 1.45)
const wedge = (from: number, to: number) => {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return `${50 + 50 * Math.cos(rad)} ${50 + 50 * Math.sin(rad)}`
  }
  return `M50 50 L${point(from)} A50 50 0 0 1 ${point(to)} Z`
}

// `color` presses the record in another vinyl (the footer's oxblood); grooves are drawn lighter over it either way.
export const VinylDisc = ({ size, color = colors.vinyl }: { size: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Circle cx={50} cy={50} r={50} fill={color} />
    {GROOVES.map((r) => (
      <Circle key={r} cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth={0.55} />
    ))}
    <Path d={wedge(66, 80)} fill="rgba(255,255,255,0.07)" />
    <Path d={wedge(246, 262)} fill="rgba(255,255,255,0.05)" />
    <Circle cx={50} cy={50} r={49.6} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.6} />
  </Svg>
)

// The center label: the record's real label photo when there is one, else its cover. Spins at 9s a turn like the web.
export const VinylLabel = ({ size, src, spin = false, rotation }: { size: number; src?: string | null; spin?: boolean; rotation?: SharedValue<number> }) => {
  const turn = useSharedValue(0)
  useEffect(() => {
    if (!spin) return
    turn.value = withRepeat(withTiming(360, { duration: 9000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(turn)
  }, [spin, turn])
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation ? rotation.value : turn.value}deg` }] }))
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.paper }, style]}>
      {src ? (
        <Image
          source={src}
          style={[StyleSheet.absoluteFill, isCdArt(src) && { transform: [{ scale: 1.04 }], backgroundColor: '#000' }]}
          contentFit="cover"
          transition={200}
        />
      ) : null}
      <View style={[styles.hole, { width: size * 0.12, height: size * 0.12, borderRadius: size, marginLeft: -size * 0.06, marginTop: -size * 0.06 }]} />
    </Animated.View>
  )
}

type SleeveProps = {
  size: number
  cover?: string | null
  label?: string | null
  // Pull the record halfway out once the page has landed (the web's vinylPullOut).
  out?: boolean
  spin?: boolean
  // 0..1 driven by the parent: presses pull the record up out of the sleeve, the touch version of the web's hover.
  pull?: SharedValue<number>
  // Takes part in the cover morph (morph.tsx) under this key: tiles register as sources, the album page passes
  // sleeveRef to land on. Either way the sleeve hides while its copy is in flight.
  morphKey?: string
  sleeveRef?: RefObject<ComponentRef<typeof View> | null>
  // Fires once the sleeve's cover has painted, so a morph can hand over without an empty frame.
  onSleeveReady?: () => void
  style?: ViewStyle
}

export const VinylSleeve = ({ size, cover, label, out = false, spin = false, pull, morphKey, sleeveRef, onSleeveReady, style }: SleeveProps) => {
  const disc = size * 0.92
  const ownRef = useRef<ComponentRef<typeof View>>(null)
  const ref = sleeveRef ?? ownRef
  useEffect(() => {
    if (!morphKey || sleeveRef) return
    registerSource(morphKey, ownRef.current)
    return () => registerSource(morphKey, null)
  }, [morphKey, sleeveRef])

  // The web's vinylPullOut: the record waits behind the sleeve until the cover has landed (0.5s delay, then held for
  // 35% of 1.1s), shows, and slides 40% out.
  const shown = useSharedValue(out ? 0 : 1)
  const slide = useSharedValue(0)
  useEffect(() => {
    if (!out) return
    shown.value = withDelay(885, withTiming(1, { duration: 110 }))
    slide.value = withDelay(995, withTiming(1, { duration: 605, easing: easeOut }))
  }, [out, shown, slide])
  const discStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [
      { translateX: slide.value * size * 0.4 },
      { translateY: pull ? -pull.value * size * 0.18 : 0 },
    ],
  }))
  const sleeveStyle = useAnimatedStyle(() => ({ opacity: morphKey && hidden.value === morphKey ? 0 : 1 }))

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View style={[styles.disc, { width: disc, height: disc, left: size * 0.04, top: size * 0.04 }, discStyle]}>
        <VinylDisc size={disc} />
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <VinylLabel size={disc * 0.34} src={label || cover} spin={spin} />
        </View>
      </Animated.View>
      {/* iOS drops shadows on views that clip, so the shadow and the clip live on separate views. */}
      <Animated.View ref={ref} collapsable={false} onLayout={cover ? undefined : onSleeveReady} style={[styles.sleeve, sleeveStyle]}>
        <View style={styles.sleeveClip}>
          {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={morphKey ? 0 : 300} recyclingKey={cover} onLoad={onSleeveReady} /> : null}
          <View style={styles.sleeveRing} />
        </View>
      </Animated.View>
    </View>
  )
}

// The brand mark from the web nav: a tiny record.
export const MusicoMark = ({ size = 28 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Circle cx={16} cy={16} r={15.5} fill={colors.vinyl} stroke="rgba(255,255,255,0.16)" />
    <Circle cx={16} cy={16} r={12} fill="none" stroke="rgba(255,255,255,0.09)" />
    <Circle cx={16} cy={16} r={9} fill="none" stroke="rgba(255,255,255,0.09)" />
    <Path d="M5.5 11 A11.5 11.5 0 0 1 11 5.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.4} strokeLinecap="round" />
    <Circle cx={16} cy={16} r={5.6} fill={colors.paper} />
    <Circle cx={16} cy={16} r={1.2} fill={colors.vinyl} />
  </Svg>
)

const styles = StyleSheet.create({
  disc: { position: 'absolute', borderRadius: 9999, shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 20 }, elevation: 8 },
  center: { alignItems: 'center', justifyContent: 'center' },
  hole: { position: 'absolute', left: '50%', top: '50%', backgroundColor: '#000' },
  sleeve: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: colors.panel,
    shadowColor: '#000',
    shadowOpacity: 0.9,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 30 },
    elevation: 12,
  },
  sleeveClip: { flex: 1, borderRadius: 4, overflow: 'hidden' },
  sleeveRing: { ...StyleSheet.absoluteFill, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
})
