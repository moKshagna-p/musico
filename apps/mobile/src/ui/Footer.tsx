import { FontAwesome5 } from '@expo/vector-icons'
import { router, type Href } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg'

import { Muted, Press, T, scalesUp } from './kit'
import { useReveal } from './scroll'
import { colors, display, fonts, GUTTER } from './theme'
import { MusicoMark, VinylDisc } from './vinyl'

const COLUMNS: { title: string; links: { label: string; to: Href }[] }[] = [
  { title: 'Explore', links: [{ label: 'Home', to: '/' }, { label: 'Discover', to: '/discover' }, { label: 'Feed', to: '/feed' }] },
  { title: 'You', links: [{ label: 'Profile', to: '/profile' }, { label: 'Listening history', to: '/profile/history' }] },
]
const SOCIALS = [
  { icon: 'github', label: 'GitHub', href: 'https://github.com/moKshagna-p/musico' },
  { icon: 'itunes-note', label: 'Apple Music', href: 'https://music.apple.com/profile/mokshagna45' },
]

// The web footer, with its oxblood pressing that rises out of the bottom edge the first time it scrolls into view.
export const Footer = () => {
  const { width } = useWindowDimensions()
  const { shown: rise, ref, onLayout } = useReveal(1400, 120)
  const [wordWidth, setWordWidth] = useState(0)
  const em = width * 0.2 // text-[20vw]
  const record = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateX: (1 - rise.value) * em * 2.25 * 0.2 }, { translateY: (1 - rise.value) * em * 2.25 * 0.45 }, { rotate: `${(1 - rise.value) * 120}deg` }],
  }))

  return (
    <View ref={ref} onLayout={onLayout} style={styles.footer}>
      <Press onPress={() => router.navigate('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }} accessibilityLabel="Musico home">
        <MusicoMark size={24} />
        <T style={display(20)}>musico</T>
      </Press>
      <T style={[display(30), { marginTop: 24, lineHeight: 32 }]}>Good taste, on the record.</T>
      <Muted style={{ marginTop: 12, maxWidth: 300 }}>Rate records, keep lists, and follow people with good taste.</Muted>

      <View style={{ flexDirection: 'row', marginTop: 48 }}>
        {COLUMNS.map((column) => (
          <View key={column.title} style={{ flex: 1 }}>
            <T style={styles.columnTitle}>{column.title}</T>
            <View style={{ marginTop: 16, gap: 10 }}>
              {column.links.map((link) => (
                <T key={link.label} onPress={() => router.navigate(link.to)} style={{ fontSize: 14, color: 'rgba(238,234,227,0.7)' }}>{link.label}</T>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.legal}>
        <Muted>
          © {new Date().getFullYear()} Musico · Data from{' '}
          <Muted onPress={() => WebBrowser.openBrowserAsync('https://www.discogs.com/')}>Discogs</Muted>
        </Muted>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {SOCIALS.map((social) => (
            <Press key={social.label} onPress={() => WebBrowser.openBrowserAsync(social.href)} style={styles.social} accessibilityLabel={social.label}>
              <FontAwesome5 name={social.icon} brand size={15} color={colors.muted} />
            </Press>
          ))}
        </View>
      </View>

      {/* The faded wordmark sits on the footer's bottom edge, with the record placed in em from its last "o". */}
      <View style={{ marginTop: 24, height: em * 1.15 * 0.86, alignSelf: 'flex-start' }}>
        <Text allowFontScaling={scalesUp} onLayout={(event) => setWordWidth(event.nativeEvent.layout.width)} style={[styles.measure, { fontSize: em, letterSpacing: -0.035 * em }]}>musico</Text>
        {wordWidth ? (
          <>
            <Animated.View style={[{ position: 'absolute', left: wordWidth + em * 0.05, bottom: -em * 0.87 + em * 0.14, width: em * 2.25, height: em * 2.25 }, record]}>
              <VinylDisc size={em * 2.25} color="#5c1420" />
              <View style={[styles.label, { width: em * 2.25 * 0.24, height: em * 2.25 * 0.24, marginLeft: -em * 2.25 * 0.12, marginTop: -em * 2.25 * 0.12 }]} />
              <View style={[styles.spindle, { width: em * 2.25 * 0.03, height: em * 2.25 * 0.03, marginLeft: -em * 2.25 * 0.015, marginTop: -em * 2.25 * 0.015 }]} />
            </Animated.View>
            <Svg width={wordWidth + 4} height={em * 1.15} style={{ position: 'absolute', left: 0, top: 0 }}>
              <Defs>
                <LinearGradient id="word" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#fff" stopOpacity={0.16} />
                  <Stop offset="1" stopColor="#fff" stopOpacity={0.04} />
                </LinearGradient>
              </Defs>
              <SvgText x={0} y={em * 0.92} fontFamily={fonts.bold} fontSize={em} letterSpacing={-0.035 * em} fill="url(#word)">musico</SvgText>
            </Svg>
          </>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { marginTop: 96, overflow: 'hidden', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingTop: 56, paddingHorizontal: GUTTER },
  columnTitle: { fontSize: 12, letterSpacing: 2.4, textTransform: 'uppercase', color: 'rgba(142,139,133,0.7)' },
  legal: { marginTop: 56, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingTop: 24 },
  social: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  measure: { position: 'absolute', opacity: 0, fontFamily: fonts.bold },
  label: { position: 'absolute', left: '50%', top: '50%', borderRadius: 999, backgroundColor: 'rgba(238,234,227,0.9)' },
  spindle: { position: 'absolute', left: '50%', top: '50%', borderRadius: 999, backgroundColor: colors.canvas },
})
