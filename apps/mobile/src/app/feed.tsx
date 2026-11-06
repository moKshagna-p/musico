import { Feather } from '@expo/vector-icons'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native'
import Animated, { Easing, FadeInDown, FadeInLeft, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

// Same grouping as the web feed, so a sitting reads identically on both.
import { feedDays, groupFeed } from '../../../web/src/services/feedGroups.js'
import { fetchFeed, fetchFollowing, searchUsers } from '@/lib/api'
import { useAuth } from '@/lib/state'
import { Avatar, Display, Muted, PrimaryButton, Skeleton, T, scalesUp } from '@/ui/kit'
import { ActivityCard, FollowButton } from '@/ui/people'
import { Screen } from '@/ui/Screen'
import { colors, easeOut, fonts } from '@/ui/theme'

const PeopleSearch = () => {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])
  const { user } = useAuth()
  const results = useQuery({ queryKey: ['user-search', debounced], queryFn: () => searchUsers(debounced), enabled: debounced.length >= 2 })
  // Search results don't say whether you follow someone, and following is a toggle, so the button waits for your
  // real follow list instead of guessing "not following" (which would unfollow on tap).
  const following = useQuery({ queryKey: ['my-following'], queryFn: fetchFollowing, enabled: debounced.length >= 2 })
  const followed = useMemo(() => new Set((following.data ?? []).map((person) => person.id)), [following.data])
  const searching = debounced.length >= 2
  return (
    <View>
      <View style={[styles.search, focused && styles.searchFocused]}>
        <Feather name="search" size={16} color={focused ? 'rgba(255,255,255,0.6)' : 'rgba(142,139,133,0.6)'} />
        <TextInput allowFontScaling={scalesUp}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search for people to follow…"
          placeholderTextColor="rgba(142,139,133,0.5)"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        {query ? (
          <Pressable hitSlop={10} onPress={() => setQuery('')} accessibilityLabel="Clear search"><Feather name="x" size={16} color="rgba(142,139,133,0.6)" /></Pressable>
        ) : null}
      </View>
      {searching ? (
        <Animated.View entering={FadeInDown.duration(200).easing(easeOut)} exiting={FadeOut.duration(150)} style={styles.results}>
          {following.isError ? (
            <View style={styles.followError}>
              <Muted style={{ flex: 1, fontSize: 12 }}>Couldn’t load who you follow, so follow buttons are hidden.</Muted>
              <Pressable onPress={() => void following.refetch()} hitSlop={8} accessibilityLabel="Retry loading who you follow">
                <T style={{ fontSize: 12, textDecorationLine: 'underline' }}>Retry</T>
              </Pressable>
            </View>
          ) : null}
          {results.isLoading || debounced !== query.trim() ? (
            [1, 2, 3].map((key) => (
              <View key={key} style={styles.person}>
                <Skeleton style={{ width: 40, height: 40 }} />
                <View style={{ flex: 1, gap: 8 }}><Skeleton style={{ height: 13, width: 96 }} /><Skeleton style={{ height: 11, width: 64 }} /></View>
              </View>
            ))
          ) : results.data?.length ? (
            results.data.map((person, index) => (
              <Animated.View key={person.userId ?? person.username} entering={FadeInLeft.delay(index * 40).duration(250).easing(easeOut)} style={styles.person}>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} onPress={() => person.username && router.push({ pathname: '/user/[username]', params: { username: person.username } })}>
                  <Avatar person={person} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <T numberOfLines={1} style={{ fontSize: 14, fontFamily: fonts.medium }}>{person.name}</T>
                      {person.isPrivate ? <Feather name="lock" size={11} color="rgba(142,139,133,0.5)" /> : null}
                    </View>
                    <Muted numberOfLines={1} style={{ fontSize: 12, color: 'rgba(142,139,133,0.6)' }}>@{person.username}</Muted>
                  </View>
                </Pressable>
                {person.id !== user?.id && person.username && following.isSuccess ? <FollowButton username={person.username} initialFollowing={followed.has(person.id)} /> : null}
              </Animated.View>
            ))
          ) : (
            <Muted style={{ padding: 24, textAlign: 'center', color: 'rgba(142,139,133,0.7)' }}>No users found for “{query}”</Muted>
          )}
        </Animated.View>
      ) : null}
    </View>
  )
}

const Step = ({ number, title, description }: { number: string; title: string; description: string }) => (
  <View style={{ flexDirection: 'row', gap: 16, paddingVertical: 12 }}>
    <View style={styles.stepNumber}><T style={{ fontFamily: fonts.bold, fontSize: 17, color: 'rgba(238,234,227,0.5)' }}>{number}</T></View>
    <View style={{ flex: 1, paddingTop: 2 }}>
      <T style={{ fontSize: 14, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.9)' }}>{title}</T>
      <Muted style={{ marginTop: 2, fontSize: 12, color: 'rgba(142,139,133,0.6)' }}>{description}</Muted>
    </View>
  </View>
)

const EmptyFeed = () => (
  <Animated.View entering={FadeInDown.duration(400).easing(easeOut)} style={styles.empty}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 28, paddingBottom: 8 }}>
      <View style={styles.emptyIcon}><Feather name="music" size={24} color="rgba(255,255,255,0.5)" /></View>
      <View style={{ flex: 1 }}>
        <Display size={28}>Your feed is quiet</Display>
        <Muted style={{ marginTop: 2, color: 'rgba(142,139,133,0.7)' }}>Follow music lovers to see what they’re listening to</Muted>
      </View>
    </View>
    <View style={{ paddingHorizontal: 28, paddingVertical: 20 }}>
      <Step number="1" title="Find People" description="Use the search bar above to discover other users" />
      <Step number="2" title="Follow Them" description="Hit the follow button to see their activity" />
      <Step number="3" title="See Their Taste" description="Ratings, reviews, and lists will appear right here" />
    </View>
    <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(35,34,32,0.4)', padding: 20, paddingHorizontal: 28 }}>
      <PrimaryButton label="Discover Music" icon="users" onPress={() => router.navigate('/discover')} />
    </View>
  </Animated.View>
)

// The refresh icon spins while loading, like the web's animate-spin.
const RefreshButton = ({ loading, onPress }: { loading: boolean; onPress: () => void }) => {
  const turn = useSharedValue(0)
  useEffect(() => {
    turn.value = loading ? withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false) : withTiming(0)
  }, [loading, turn])
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  return (
    <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.7 }]} accessibilityLabel="Refresh feed">
      <Animated.View style={spin}><Feather name="refresh-cw" size={14} color="rgba(238,234,227,0.8)" /></Animated.View>
      <T style={{ fontSize: 14, color: 'rgba(238,234,227,0.8)' }}>Refresh</T>
    </Pressable>
  )
}

export default function Feed() {
  const { user, isPending } = useAuth()
  useEffect(() => {
    if (!isPending && !user) router.replace('/auth')
  }, [isPending, user])
  const feed = useInfiniteQuery({
    queryKey: ['feed', user?.id ?? null],
    queryFn: ({ pageParam }) => fetchFeed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page: any) => page?.nextCursor || undefined,
    enabled: !isPending && Boolean(user?.id),
  })
  const items = useMemo(() => feed.data?.pages.flatMap((page: any) => page?.data ?? []) ?? [], [feed.data])
  const days = useMemo(() => feedDays(groupFeed(items)), [items])

  return (
    <Screen onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()} refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()}>
      <Animated.View entering={FadeInDown.duration(500).easing(easeOut)} style={{ paddingTop: 16, paddingBottom: 32, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Display size={60}>Feed</Display>
          <Muted style={{ marginTop: 12, fontSize: 15 }}>What the people you follow are rating, reviewing, and saving.</Muted>
        </View>
        <RefreshButton loading={feed.isFetching} onPress={() => void feed.refetch()} />
      </Animated.View>

      <View style={{ marginBottom: 32 }}><PeopleSearch /></View>

      {feed.isLoading || isPending ? (
        <View style={{ gap: 28 }}>
          {[0, 1, 2].map((key) => (
            <View key={key} style={{ flexDirection: 'row', gap: 14 }}>
              <Skeleton style={{ width: 40, height: 40 }} />
              <View style={{ flex: 1, gap: 10 }}>
                <Skeleton style={{ height: 14, width: 120 }} />
                <Skeleton style={{ height: 52, width: '100%', borderRadius: 6 }} />
              </View>
            </View>
          ))}
        </View>
      ) : feed.error ? (
        <Animated.View entering={FadeInDown} style={styles.error}>
          <Muted style={{ textAlign: 'center', color: 'rgba(142,139,133,0.7)' }}>{feed.error.message}</Muted>
          <Pressable onPress={() => void feed.refetch()} style={styles.tryAgain}><T style={{ fontSize: 14 }}>Try Again</T></Pressable>
        </Animated.View>
      ) : !items.length ? (
        <EmptyFeed />
      ) : (
        days.map((day: any) => (
          <View key={day.label}>
            <T style={styles.day}>{day.label}</T>
            {day.groups.map((group: any, index: number) => <ActivityCard key={group.id} group={group} index={index} />)}
          </View>
        ))
      )}
      {feed.isFetchingNextPage ? <ActivityIndicator color={colors.paper} style={{ marginTop: 24 }} /> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 20 },
  searchFocused: { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.06)' },
  input: { flex: 1, color: '#fff', fontFamily: fonts.regular, fontSize: 14, paddingVertical: 13 },
  results: { marginTop: 12, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, overflow: 'hidden' },
  followError: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  day: { marginTop: 24, marginBottom: 4, fontSize: 12, letterSpacing: 2.4, textTransform: 'uppercase', color: 'rgba(142,139,133,0.8)' },
  empty: { marginTop: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  stepNumber: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, paddingVertical: 9 },
  error: { borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: 32, alignItems: 'center' },
  tryAgain: { marginTop: 16, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 20, paddingVertical: 8 },
})
