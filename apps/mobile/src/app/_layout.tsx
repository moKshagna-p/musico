import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_900Black,
  useFonts,
} from '@expo-google-fonts/schibsted-grotesk'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DarkTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'

import { MeProvider } from '@/lib/state'
import { Dock } from '@/ui/Dock'
import { MorphLayer } from '@/ui/morph'
import { colors } from '@/ui/theme'

void SplashScreen.preventAutoHideAsync()

// Same cache policy as the web (main.jsx).
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, gcTime: 1000 * 60 * 60, retry: 1 } },
})

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.canvas, card: colors.canvas, text: colors.paper, primary: colors.paper } }

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_900Black,
  })
  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync()
  }, [fontsLoaded])
  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <MeProvider>
            <ThemeProvider value={theme}>
              <StatusBar style="light" />
              <View style={{ flex: 1 }}>
                {/* Pages fade through like the web's, so the flying cover is the only thing that moves across them. */}
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'fade', animationDuration: 350 }} />
                <Dock />
                <MorphLayer />
              </View>
            </ThemeProvider>
          </MeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}
