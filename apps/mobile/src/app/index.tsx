import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { getHomeSections } from '@/lib/api'
import { AlbumRow, Billboard, openAlbum } from '@/ui/album'
import { ArtistName, Display, PrimaryButton, Skeleton, StarValue, T } from '@/ui/kit'
import { Screen } from '@/ui/Screen'
import { easeOut } from '@/ui/theme'

const rise = (delay: number) => FadeInDown.delay(delay).duration(500).easing(easeOut).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })

export default function Home() {
  const home = useQuery({ queryKey: ['home-sections'], queryFn: getHomeSections })
  const top = home.data?.mostHappening[0]
  const loading = home.isLoading
  const error = home.error?.message ?? home.data?.error ?? null

  return (
    <Screen bleed refreshing={home.isRefetching} onRefresh={() => void home.refetch()}>
      <Billboard artist={top?.artists?.[0]} cover={top?.cover}>
        {top ? (
          // Phones skip the sleeve here, like the web: it would cover the artist photo, and the same cover leads the row below.
          <View>
            <Animated.View entering={rise(0)} style={{ alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 12, paddingVertical: 4 }}>
              <T style={{ fontSize: 12, fontFamily: 'SchibstedGrotesk_500Medium', color: 'rgba(238,234,227,0.9)' }}>No. 1 on this week’s chart</T>
            </Animated.View>
            <Animated.View entering={rise(80)}>
              <Display size={48} style={{ marginTop: 20 }}>{top.name}</Display>
            </Animated.View>
            <Animated.View entering={rise(160)} style={{ marginTop: 16 }}>
              <ArtistName artists={top.artists} logoHeight={40} style={{ fontSize: 18, fontFamily: 'SchibstedGrotesk_500Medium', color: 'rgba(238,234,227,0.85)' }} />
              <View style={{ marginTop: 4, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <T style={{ fontSize: 14, color: 'rgba(238,234,227,0.6)' }}>{top.releaseYear ?? ''}</T>
                {top.communityRating ? <StarValue value={Number(top.communityRating)} color="rgba(238,234,227,0.6)" /> : null}
              </View>
            </Animated.View>
            <Animated.View entering={rise(240)} style={{ marginTop: 32 }}>
              <PrimaryButton label="Open album" icon="arrow-up-right" onPress={() => openAlbum(top)} />
            </Animated.View>
          </View>
        ) : loading ? (
          <View>
            <Skeleton style={{ height: 26, width: 176 }} />
            <Skeleton style={{ marginTop: 20, height: 44, width: '100%', borderRadius: 12 }} />
            <Skeleton style={{ marginTop: 20, height: 20, width: 160 }} />
            <Skeleton style={{ marginTop: 10, height: 14, width: 64 }} />
            <Skeleton style={{ marginTop: 32, height: 44, width: 160 }} />
          </View>
        ) : (
          // The chart failed or came back empty; the rows below explain which.
          <View>
            <Display size={48}>Dig through the vault</Display>
            <View style={{ marginTop: 32 }}><PrimaryButton label="Discover albums" icon="arrow-up-right" onPress={() => router.navigate('/discover')} /></View>
          </View>
        )}
      </Billboard>

      <View style={{ marginTop: -24, gap: 40 }}>
        <AlbumRow title="Most Happening Right Now" note="This week's chart, ranked." albums={home.data?.mostHappening ?? []} loading={loading} error={error} ranked />
        <AlbumRow title="Recent Releases" note="Fresh pressings from the past few weeks." albums={home.data?.recentReleases ?? []} loading={loading} error={error} />
      </View>
    </Screen>
  )
}
