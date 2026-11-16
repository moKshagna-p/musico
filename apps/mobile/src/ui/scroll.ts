import { createContext, useContext, useRef, type ComponentRef } from 'react'
import type { View } from 'react-native'
import { makeMutable, useAnimatedReaction, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'

import { easeOut } from './theme'

// What a page knows about its scroll, for parallax heroes and the footer's record rising into view.
// scrollTo moves the page itself, for fields whose dropdown needs room above the keyboard.
export const ScrollContext = createContext<{ scrollY: SharedValue<number>; viewport: number; scrollTo: (y: number) => void } | null>(null)
export const usePageScroll = () => {
  const context = useContext(ScrollContext)
  if (!context) throw new Error('usePageScroll must be used inside Screen')
  return context
}

// The floating dock (Dock.tsx) slides away while you scroll down or leave the page alone, so it never sits over
// the art, and comes back when you scroll up or touch the page. 1 means hidden.
export const dockHidden = makeMutable(0)
const IDLE_MS = 3000
let idle: ReturnType<typeof setTimeout> | undefined
export const showDock = () => {
  dockHidden.value = 0
  clearTimeout(idle)
  idle = setTimeout(() => {
    dockHidden.value = 1
  }, IDLE_MS)
}

// The web's whileInView={{ ... }} viewport={{ once: true }}: a 0→1 value that plays the first time the view scrolls in.
// Its spot on the page is the window position at layout plus how far the page had scrolled.
export const useReveal = (duration = 700, offset = 0) => {
  const { scrollY, viewport } = usePageScroll()
  const top = useSharedValue(-1)
  const shown = useSharedValue(0)
  useAnimatedReaction(
    () => top.value >= 0 && scrollY.value + viewport > top.value + offset + 80,
    (visible) => {
      if (visible && shown.value === 0) shown.value = withTiming(1, { duration, easing: easeOut })
    },
  )
  const ref = useRef<ComponentRef<typeof View>>(null)
  const onLayout = () => {
    ref.current?.measureInWindow((_x, y) => {
      top.value = y + scrollY.value
    })
  }
  return { shown, ref, onLayout }
}

