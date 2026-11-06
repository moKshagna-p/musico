import { Image } from 'expo-image'
import { useSyncExternalStore } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, makeMutable, runOnJS, useAnimatedStyle, withTiming } from 'react-native-reanimated'

// The web's album-cover View Transition (utils/morph.js), by hand: the tapped sleeve flies into the album page's
// sleeve, and back into its tile when you leave. Only the sleeve flies; the record stays put and fades with the page.
// Every sleeve that can take part registers under a key, and the one in flight (`hidden`) is hidden at both ends,
// so the flying copy is the only one on screen.

type Rect = { x: number; y: number; w: number; h: number }
type Measurable = { measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) => void }

const DURATION = 800
// The web's ::view-transition-group(album-cover): slow enough to follow, easing in and settling softly.
const CURVE = Easing.bezier(0.5, 0, 0.15, 1)

export const hidden = makeMutable('')
const from = makeMutable<Rect>({ x: 0, y: 0, w: 0, h: 0 })
const to = makeMutable<Rect>({ x: 0, y: 0, w: 0, h: 0 })
const progress = makeMutable(0)

const sources = new Map<string, Measurable>()
let cover: string | null = null
// A flight to the album page ends when it has both arrived and the page's sleeve is on screen to take over.
let pending: { key: string; flown: boolean; landed: boolean } | null = null
const listeners = new Set<() => void>()
const setCover = (next: string | null) => {
  cover = next
  listeners.forEach((listener) => listener())
}

// Never lets a tap hang: a node that can't be measured within a couple of frames just skips the flight.
const measure = (node: Measurable | null | undefined) =>
  new Promise<Rect | null>((resolve) => {
    if (!node?.measureInWindow) return resolve(null)
    const timer = setTimeout(() => resolve(null), 120)
    try {
      node.measureInWindow((x, y, w, h) => {
        clearTimeout(timer)
        resolve(w > 0 ? { x, y, w, h } : null)
      })
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })

// Flying to or from something off screen just looks like a glitch, as on the web; those skip the flight.
const onScreen = (rect: Rect | null, screenHeight: number) => Boolean(rect && rect.y + rect.h > 0 && rect.y < screenHeight)

const finish = () => {
  pending = null
  hidden.value = ''
  setCover(null)
}

const settle = (key: string, part: 'flown' | 'landed') => {
  if (pending?.key !== key) return
  pending[part] = true
  if (pending.flown && pending.landed) finish()
}

const fly = (start: Rect, end: Rect, onArrive: () => void) => {
  from.value = start
  to.value = end
  progress.value = 0
  progress.value = withTiming(1, { duration: DURATION, easing: CURVE }, (done) => {
    if (done) runOnJS(onArrive)()
  })
}

export const registerSource = (key: string, node: Measurable | null) => {
  if (node) sources.set(key, node)
  else sources.delete(key)
}

// Card tapped: the sleeve takes off at once toward where the album page puts its sleeve (`towards`), while that page
// is still being built. When the page's sleeve is laid out, land() re-aims the flight at its measured spot mid-air.
export const takeOff = async (key: string, image: string | null | undefined, towards: Rect) => {
  const rect = await measure(sources.get(key))
  if (!rect || !image) return
  pending = { key, flown: false, landed: false }
  hidden.value = key
  setCover(image)
  fly(rect, towards, () => settle(key, 'flown'))
  // A page that never reports its sleeve (an error, say) must not leave the cover hanging.
  setTimeout(() => settle(key, 'landed'), 4000)
}

export const land = async (key: string, target: Measurable | null, screenHeight: number) => {
  if (pending?.key !== key) return
  const end = await measure(target)
  if (end && onScreen(end, screenHeight)) to.value = end
  settle(key, 'landed')
}

// Leaving the album page: its sleeve flies home to the tile that opened it, if that tile is still on screen.
export const flyHome = async (key: string, image: string | null | undefined, target: Measurable | null, screenHeight: number) => {
  const [start, end] = await Promise.all([measure(target), measure(sources.get(key))])
  if (!image || !start || !end || !onScreen(start, screenHeight) || !onScreen(end, screenHeight)) return
  pending = null
  hidden.value = key
  setCover(image)
  fly(start, end, finish)
}

// The flying sleeve, drawn above every screen (rendered last in the root layout).
export const MorphLayer = () => {
  const image = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => cover,
  )
  const style = useAnimatedStyle(() => {
    const t = progress.value
    const a = from.value
    const b = to.value
    return {
      left: a.x + (b.x - a.x) * t,
      top: a.y + (b.y - a.y) * t,
      width: a.w + (b.w - a.w) * t,
      height: a.h + (b.h - a.h) * t,
    }
  })
  if (!image) return null
  return (
    <Animated.View pointerEvents="none" style={[styles.flight, style]}>
      <View style={styles.clip}>
        <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  flight: { position: 'absolute', borderRadius: 4, backgroundColor: '#0d0d0c', shadowColor: '#000', shadowOpacity: 0.9, shadowRadius: 30, shadowOffset: { width: 0, height: 30 }, elevation: 24 },
  clip: { flex: 1, borderRadius: 4, overflow: 'hidden' },
})
