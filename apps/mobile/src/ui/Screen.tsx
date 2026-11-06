import { useRef, type ComponentRef, type ReactNode } from 'react'
import { RefreshControl, useWindowDimensions, type NativeScrollEvent } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import Animated, { runOnJS, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Footer } from './Footer'
import { ScrollContext } from './scroll'
import { colors, GUTTER, NAV_SPACE } from './theme'

type ScreenProps = {
  children: ReactNode
  // `bleed` pages run edge to edge under the floating nav and lay out their own gutters (the web's PageTransition).
  bleed?: boolean
  footer?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  onEndReached?: () => void
}

// Every page scrolls in one of these. It keeps the focused input above the keyboard on both platforms
// (react-native-keyboard-controller), so typing never hides what you're typing into.
export const Screen = ({ children, bleed = false, footer = true, refreshing, onRefresh, onEndReached }: ScreenProps) => {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const scrollY = useSharedValue(0)
  const scroller = useRef<ComponentRef<typeof KeyboardAwareScrollView>>(null)
  const scrollTo = (y: number) => scroller.current?.scrollTo({ y: Math.max(0, y), animated: true })
  const nearEnd = (event: NativeScrollEvent) => {
    'worklet'
    return event.contentOffset.y + event.layoutMeasurement.height > event.contentSize.height - 800
  }
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
    if (onEndReached && nearEnd(event)) runOnJS(onEndReached)()
  })

  return (
    <ScrollContext.Provider value={{ scrollY, viewport: height, scrollTo }}>
      <KeyboardAwareScrollView
        ref={scroller}
        onScroll={onScroll}
        bottomOffset={96}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        style={{ flex: 1, backgroundColor: colors.canvas }}
        contentContainerStyle={{ paddingBottom: insets.bottom + (footer ? 0 : 48) }}
        refreshControl={onRefresh ? <RefreshControl tintColor={colors.paper} progressViewOffset={insets.top + 60} refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
      >
        <Animated.View style={bleed ? { paddingBottom: 48 } : { paddingTop: insets.top + NAV_SPACE, paddingHorizontal: GUTTER, paddingBottom: 32 }}>{children}</Animated.View>
        {footer ? <Footer /> : null}
      </KeyboardAwareScrollView>
    </ScrollContext.Provider>
  )
}
