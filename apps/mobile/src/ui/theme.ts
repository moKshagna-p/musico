import { Easing } from 'react-native-reanimated'

// Same palette as the web's tailwind.config.js.
export const colors = {
  canvas: '#000000',
  panel: '#0d0d0c',
  outline: '#232220',
  muted: '#8e8b85',
  paper: '#eeeae3',
  vinyl: '#0b0b0b',
  line: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.15)',
  wash: 'rgba(255,255,255,0.04)',
}

export const fonts = {
  regular: 'SchibstedGrotesk_400Regular',
  medium: 'SchibstedGrotesk_500Medium',
  semibold: 'SchibstedGrotesk_600SemiBold',
  bold: 'SchibstedGrotesk_700Bold',
  black: 'SchibstedGrotesk_900Black',
}

// The web's .font-display: heavy and tight, like a record-store poster (-0.035em).
export const display = (size: number) => ({
  fontFamily: fonts.bold,
  fontSize: size,
  lineHeight: size * 0.98,
  letterSpacing: -0.035 * size,
  color: colors.paper,
})

// The web's signature curve, cubic-bezier(0.16, 1, 0.3, 1).
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1)
export const spring = { damping: 18, stiffness: 220, mass: 0.7 }

export const GUTTER = 16
// Screens pad their bottom by this so the last row clears the floating dock.
export const DOCK_SPACE = 110
// Non-bleed pages start below the floating nav (the web's pt-28).
export const NAV_SPACE = 96
