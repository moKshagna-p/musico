import { router } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { useEffect } from 'react'

import { useAuth } from '@/lib/state'
import { colors } from '@/ui/theme'

// The dock's pages are tabs, so each stays mounted once visited: switching back is instant and keeps its scroll.
// The Dock in the root layout is the only tab bar. Album, profile and list pages push above the tabs.
export default function TabsLayout() {
  const { user } = useAuth()
  const signedIn = Boolean(user?.id)

  // Once Home is up, mount the other tabs in the background one at a time (each is a burst of rendering), so even a
  // first visit is instant. Feed and Profile only exist signed in; signed out they would redirect to sign-in.
  useEffect(() => {
    const tabs = signedIn ? (['/discover', '/feed', '/profile'] as const) : (['/discover'] as const)
    const timers = tabs.map((href, index) => setTimeout(() => router.prefetch(href), 700 * (index + 1)))
    return () => timers.forEach(clearTimeout)
  }, [signedIn])

  return (
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: colors.canvas } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
