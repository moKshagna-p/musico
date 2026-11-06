import { Feather } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { searchReleases } from '@/lib/api'
import { openAlbum } from './album'
import { usePageScroll } from './scroll'
import { Muted, Skeleton, T, scalesUp } from './kit'
import { colors, fonts } from './theme'

// Recent searches, like the web's searchHistoryService: ten per person, newest first, deduped case-insensitively.
const MAX_HISTORY = 10
const historyKey = (scope: string) => `musico.search-history.${scope.replace(/[^\w.-]/g, '_')}`
const readHistory = (scope: string): string[] => {
  try {
    const parsed = JSON.parse(SecureStore.getItem(historyKey(scope)) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
const writeHistory = (scope: string, items: string[]) => {
  try {
    SecureStore.setItem(historyKey(scope), JSON.stringify(items))
  } catch {
    // History is a convenience; losing it never blocks a search.
  }
}

// Bold the part of a suggestion that matches what you typed (the web's HighlightMatch).
const Highlight = ({ text, match }: { text: string; match: string }) => {
  const index = text.toLowerCase().indexOf(match.toLowerCase())
  if (!match || index < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <T style={{ fontFamily: fonts.semibold, color: colors.paper, fontSize: 14 }}>{text.slice(index, index + match.length)}</T>
      {text.slice(index + match.length)}
    </>
  )
}

// The web's SearchBar: a glass pill that glows on focus, album suggestions from 3 letters, and recent searches below that.
export const SearchBar = ({ value, onChangeText, onSubmit, scope, placeholder = 'Search artists or albums...' }: { value: string; onChangeText: (value: string) => void; onSubmit: (value: string) => void; scope: string; placeholder?: string }) => {
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState<string[]>(() => readHistory(scope))
  const [debounced, setDebounced] = useState('')
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const glow = useSharedValue(0)
  const { scrollY, scrollTo } = usePageScroll()
  const insets = useSafeAreaInsets()
  useEffect(() => setHistory(readHistory(scope)), [scope])
  // Android keeps focus (and the cursor) when the keyboard goes away; the dropdown follows the keyboard instead.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      setFocused(false)
      glow.value = 0
      input.current?.blur()
    })
    return () => sub.remove()
  }, [glow])
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), 300)
    return () => clearTimeout(timer)
  }, [value])

  const suggestions = useQuery({
    queryKey: ['search-suggestions', debounced.toLowerCase()],
    queryFn: async () => (await searchReleases(debounced)).data.slice(0, 6),
    enabled: focused && debounced.length >= 3,
    staleTime: 1000 * 60 * 5,
  })

  const pill = useAnimatedStyle(() => ({
    borderColor: glow.value ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
    backgroundColor: glow.value ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
    shadowOpacity: withTiming(glow.value ? 0.12 : 0, { duration: 300 }),
  }))

  const submit = (term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    const next = [trimmed, ...history.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_HISTORY)
    setHistory(next)
    writeHistory(scope, next)
    setFocused(false)
    glow.value = 0
    input.current?.blur()
    Keyboard.dismiss()
    scrollTo(0)
    onSubmit(trimmed)
  }
  const forget = (term: string) => {
    const next = history.filter((item) => item !== term)
    setHistory(next)
    writeHistory(scope, next)
  }

  const showSuggestions = focused && value.trim().length >= 3
  const showHistory = focused && value.trim().length < 3 && history.length > 0

  return (
    <View style={{ zIndex: 10 }}>
      <Animated.View style={[styles.pill, pill]}>
        <Feather name="search" size={18} color={focused ? colors.paper : colors.muted} />
        <TextInput allowFontScaling={scalesUp}
          ref={input}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={() => submit(value)}
          onFocus={() => {
            setFocused(true)
            glow.value = 1
            // Lift the bar up under the nav so its suggestions have the room above the keyboard.
            input.current?.measureInWindow((_x, y) => {
              const target = insets.top + 76
              if (y > target + 8) scrollTo(scrollY.value + y - target)
            })
          }}
          onBlur={() => {
            setFocused(false)
            glow.value = 0
          }}
          placeholder={placeholder}
          placeholderTextColor="rgba(142,139,133,0.9)"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.input}
        />
        {value ? (
          <Pressable hitSlop={10} onPress={() => onChangeText('')} accessibilityLabel="Clear search">
            <Animated.View entering={FadeIn} exiting={FadeOut}><Feather name="x" size={18} color={colors.muted} /></Animated.View>
          </Pressable>
        ) : null}
      </Animated.View>

      {showSuggestions || showHistory ? (
        <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(150)} style={styles.dropdown}>
          {showHistory ? (
            <>
              <View style={styles.dropdownHead}>
                <Muted style={styles.caption}>Recent searches</Muted>
                <Muted style={{ fontSize: 12 }} onPress={() => { setHistory([]); writeHistory(scope, []) }}>Clear</Muted>
              </View>
              {history.map((term) => (
                <Pressable key={term} onPress={() => { onChangeText(term); submit(term) }} style={styles.row}>
                  <Feather name="clock" size={14} color={colors.muted} />
                  <T numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>{term}</T>
                  <Pressable hitSlop={10} onPress={() => forget(term)} accessibilityLabel={`Remove ${term}`}>
                    <Feather name="x" size={14} color={colors.muted} />
                  </Pressable>
                </Pressable>
              ))}
            </>
          ) : suggestions.isLoading || debounced !== value.trim() ? (
            [0, 1, 2].map((key) => (
              <View key={key} style={styles.row}>
                <Skeleton style={{ width: 40, height: 40, borderRadius: 4 }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton style={{ height: 12, width: '60%' }} />
                  <Skeleton style={{ height: 10, width: '35%' }} />
                </View>
              </View>
            ))
          ) : suggestions.data?.length ? (
            <>
              {suggestions.data.map((album) => (
                <Pressable key={album.id} onPress={() => { setFocused(false); Keyboard.dismiss(); void openAlbum(album) }} style={styles.row}>
                  <View style={styles.thumb}>{album.cover ? <Image source={album.cover} style={StyleSheet.absoluteFill} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Muted numberOfLines={1} style={{ fontSize: 14, color: 'rgba(238,234,227,0.8)' }}><Highlight text={album.name} match={value.trim()} /></Muted>
                    <Muted numberOfLines={1} style={{ fontSize: 12 }}>{album.artists?.join(', ')}{album.releaseYear ? ` · ${album.releaseYear}` : ''}</Muted>
                  </View>
                </Pressable>
              ))}
              <Pressable onPress={() => submit(value)} style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line }]}>
                <Feather name="corner-down-left" size={14} color={colors.muted} />
                <Muted numberOfLines={1} style={{ fontSize: 13 }}>See all results for “{value.trim()}”</Muted>
              </Pressable>
            </>
          ) : (
            <Muted style={{ padding: 16, textAlign: 'center' }}>No quick matches. Press search to look everywhere.</Muted>
          )}
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 999, borderWidth: 1, paddingHorizontal: 20, shadowColor: colors.paper, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  input: { flex: 1, color: colors.paper, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 15 },
  dropdown: { marginTop: 8, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0b0b0a', paddingVertical: 6, overflow: 'hidden' },
  dropdownHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  caption: { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  thumb: { width: 40, height: 40, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.panel },
})
