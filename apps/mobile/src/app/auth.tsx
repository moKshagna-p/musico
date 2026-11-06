import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, withSpring } from 'react-native-reanimated'

import { authClient, updateProfile } from '@/lib/api'
import { cleanUsername, STATUS_TEXT, useUsernameStatus } from '@/lib/username'
import { useAuth } from '@/lib/state'
import { Display, Field, Muted, Press, T } from '@/ui/kit'
import { Screen } from '@/ui/Screen'
import { colors, easeOut } from '@/ui/theme'

export default function Auth() {
  const queryClient = useQueryClient()
  const { user, isPending } = useAuth()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tabsWidth, setTabsWidth] = useState(0)
  const { status: usernameStatus, retry } = useUsernameStatus(mode === 'sign-up' ? username : '')
  const title = mode === 'sign-in' ? 'Sign In' : 'Create Account'

  // Signed in already (or just now): this page has nothing to do.
  useEffect(() => {
    if (!isPending && user) router.replace('/')
  }, [isPending, user])

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(mode === 'sign-up' ? (tabsWidth - 8) / 2 : 0, { damping: 24, stiffness: 260 }) }] }))

  const submit = async () => {
    setError('')
    if (mode === 'sign-up' && usernameStatus !== 'available') {
      setError(usernameStatus === 'error' ? STATUS_TEXT.error : usernameStatus === 'checking' ? 'Still checking that username…' : 'Pick an available username.')
      return
    }
    setSubmitting(true)
    try {
      const result = mode === 'sign-in'
        ? await authClient.signIn.email({ email: email.trim(), password })
        : await authClient.signUp.email({ email: email.trim(), password, name: name.trim() || username })
      if (result?.error) {
        setError(result.error.code === 'MAXIMUM_SESSIONS_REACHED' ? 'Try logging out in other account.' : (result.error.message ?? 'Unable to authenticate. Please try again.'))
        return
      }
      // If someone grabbed the name in the meantime, Profile still prompts for one.
      if (mode === 'sign-up') await updateProfile({ username }).catch(() => {})
      await queryClient.invalidateQueries()
      router.replace('/')
    } catch {
      setError('Unable to authenticate. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(500).easing(easeOut)} style={{ paddingTop: 24 }}>
        <Display size={48}>{title}</Display>
        <Muted style={{ marginTop: 16, fontSize: 16, lineHeight: 23 }}>
          {mode === 'sign-in' ? 'Welcome back. Your ratings, lists, and listening profile are waiting.' : 'Start rating records and building lists in under a minute.'}
        </Muted>

        <View style={styles.tabs} onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)}>
          <Animated.View style={[styles.knob, { width: (tabsWidth - 8) / 2 }, knob]} />
          {(['sign-in', 'sign-up'] as const).map((value) => (
            <Pressable key={value} style={styles.tab} onPress={() => { setMode(value); setError('') }}>
              <T style={{ fontSize: 14, color: mode === value ? '#000' : colors.muted }}>{value === 'sign-in' ? 'Sign In' : 'Create Account'}</T>
            </Pressable>
          ))}
        </View>

        <Animated.View layout={LinearTransition.duration(300).easing(easeOut)} style={{ marginTop: 24, gap: 16 }}>
          {mode === 'sign-up' ? (
            <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOut.duration(150)} style={{ gap: 16 }}>
              <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" autoComplete="name" returnKeyType="next" />
              <View>
                <Field label="Username" value={username} onChangeText={(value) => setUsername(cleanUsername(value))} placeholder="your-handle" autoComplete="username" maxLength={24} />
                <T style={{ marginTop: 6, fontSize: 12, minHeight: 16, color: usernameStatus === 'available' ? '#4ade80' : usernameStatus === 'checking' ? colors.muted : '#f87171' }}>
                  {usernameStatus ? STATUS_TEXT[usernameStatus] : ''}
                  {usernameStatus === 'error' ? <T style={{ fontSize: 12, color: '#f87171', textDecorationLine: 'underline' }} onPress={retry}>  Retry</T> : null}
                </T>
              </View>
            </Animated.View>
          ) : null}
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} textContentType={mode === 'sign-in' ? 'password' : 'newPassword'} onSubmitEditing={submit} returnKeyType="go" />
          {error ? (
            <Animated.View entering={FadeInDown} style={styles.error}>
              <T style={{ fontSize: 14, color: '#fecaca' }}>{error}</T>
            </Animated.View>
          ) : null}
          <Press onPress={submit} disabled={submitting} style={[styles.submit, submitting && { opacity: 0.6 }]}>
            <T style={{ color: '#000', fontSize: 15 }}>{submitting ? (mode === 'sign-in' ? 'Signing In…' : 'Creating Account…') : title}</T>
          </Press>
        </Animated.View>
      </Animated.View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  tabs: { marginTop: 32, flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 4 },
  knob: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 999, backgroundColor: colors.paper },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  error: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.1)', padding: 14 },
  submit: { alignItems: 'center', borderRadius: 999, backgroundColor: colors.paper, paddingVertical: 16 },
})
