import { useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { Tabs } from 'expo-router/js-tabs'
import { useEffect } from 'react'

import { fetchDashboard, fetchFeed, getRecentPopular } from '@/lib/api'
import { useAuth } from '@/lib/state'
import { colors } from '@/ui/theme'

// The dock's pages are tabs, so each stays mounted once visited: switching back is instant and keeps its scroll.
// The Dock in the root layout is the only tab bar. Album, profile and list pages push above the tabs.
export default function TabsLayout() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id ?? null

  // Load the other tabs' data once Home has had its turn, so a first visit paints content instead of skeletons.
  // The keys and fetchers match the pages' own queries, so they read this cache instead of fetching again.
  useEffect(() => {
    const timer = setTimeout(() => {
      queryClient
        .ensureQueryData({ queryKey: ['featured', 'recent-popular'], queryFn: getRecentPopular })
        .then((albums) => Image.prefetch(albums.slice(0, 6).flatMap((album) => (album.cover ? [album.cover] : []))))
        .catch(() => {})
      if (!userId) return
      void queryClient.prefetchInfiniteQuery({ queryKey: ['feed', userId], queryFn: ({ pageParam }) => fetchFeed(pageParam), initialPageParam: undefined as string | undefined })
      void queryClient.prefetchQuery({ queryKey: ['dashboard', userId], queryFn: fetchDashboard })
    }, 800)
    return () => clearTimeout(timer)
  }, [queryClient, userId])

  return (
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: colors.canvas } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
