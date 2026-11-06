import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { api, getRecentPopular, searchReleases } from '@/lib/api'
import { useAuth } from '@/lib/state'
import { AlbumGrid } from '@/ui/album'
import { Display, EmptyNote, Muted, Pill, SectionHeading } from '@/ui/kit'
import { Screen } from '@/ui/Screen'
import { SearchBar } from '@/ui/SearchBar'
import { colors, easeOut } from '@/ui/theme'

// Discover and the web's /search page in one screen: the vault until you search, then results in place.
export default function Discover() {
  const { user } = useAuth()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')

  const recent = useQuery({ queryKey: ['featured', 'recent-popular'], queryFn: getRecentPopular })
  const results = useInfiniteQuery({
    queryKey: ['search-results', query],
    queryFn: ({ pageParam }) => searchReleases(query, pageParam),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset,
    enabled: Boolean(query),
  })
  const albums = results.data?.pages.flatMap((page) => page.data) ?? []
  const corrected = results.data?.pages[0]?.correctedQuery

  const search = (value: string) => {
    setQuery(value)
    // Feeds the API's trending signals, as the web does.
    void api('/api/search-events', { method: 'POST', body: { query: value } }).catch(() => {})
  }

  return (
    <Screen onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}>
      <Animated.View entering={FadeInDown.duration(500).easing(easeOut)} style={{ paddingTop: 24 }}>
        {query ? (
          <>
            <Muted style={{ textAlign: 'center' }}>Results for</Muted>
            <Display size={48} style={{ textAlign: 'center', marginTop: 8 }}>“{query}”</Display>
          </>
        ) : (
          <>
            <Display size={48} style={{ textAlign: 'center' }}>Dig through the vault</Display>
            <Muted style={{ textAlign: 'center', marginTop: 20, fontSize: 15, paddingHorizontal: 16 }}>Search millions of releases by artist or album.</Muted>
          </>
        )}
        <View style={{ marginTop: 40 }}>
          <SearchBar
            value={draft}
            onChangeText={(value) => {
              setDraft(value)
              if (!value) setQuery('')
            }}
            onSubmit={search}
            scope={user?.id ?? 'guest'}
          />
        </View>
      </Animated.View>

      <View style={{ marginTop: 80 }}>
        {query ? (
          <Animated.View key={query} entering={FadeIn}>
            {corrected ? (
              <Muted>
                Showing results for <Muted style={{ color: colors.paper }} onPress={() => { setDraft(corrected); search(corrected) }}>{corrected}</Muted>
              </Muted>
            ) : null}
            {results.error && !results.data ? (
              <EmptyNote dashed={false}>{results.error.message}</EmptyNote>
            ) : !results.isPending && !albums.length ? (
              <EmptyNote>No records matched. Try the artist’s name, or fewer words.</EmptyNote>
            ) : (
              <AlbumGrid albums={albums} loading={results.isPending} inset={false} />
            )}
            {results.isFetchingNextPage ? <ActivityIndicator color={colors.paper} style={{ marginTop: 32 }} /> : null}
            {results.isFetchNextPageError ? (
              <View style={{ alignItems: 'center', marginTop: 24 }}><Pill label="Retry Load More" onPress={() => results.fetchNextPage()} /></View>
            ) : null}
          </Animated.View>
        ) : (
          <>
            <SectionHeading title="Recent releases" note="Popular pressings that just landed." />
            {recent.error ? (
              <View style={{ marginTop: 24 }}><EmptyNote dashed={false}>{recent.error.message}</EmptyNote></View>
            ) : (
              <AlbumGrid albums={recent.data ?? []} loading={recent.isLoading} inset={false} />
            )}
          </>
        )}
      </View>
    </Screen>
  )
}
