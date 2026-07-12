import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { authClient } from '../services/authClient.js'

export const useAuth = () => {
  const sessionState = authClient.useSession()
  const queryClient = useQueryClient()
  const userId = sessionState.data?.user?.id ?? null
  const previousUserId = useRef(userId)

  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) {
      queryClient.clear()
    }
    previousUserId.current = userId
  }, [queryClient, userId])

  const signInWithEmail = async ({ email, password }) =>
    authClient.signIn.email({
      email,
      password,
    })

  const signUpWithEmail = async ({ name, email, password }) =>
    authClient.signUp.email({
      name,
      email,
      password,
    })

  const signOutCurrentUser = async () => {
    queryClient.clear()
    return authClient.signOut()
  }
  const refreshSession = async ({ attempts = 3, delayMs = 180 } = {}) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await sessionState.refetch()
      const sessionResult = await authClient.getSession()
      if (sessionResult?.data?.user || attempt === attempts - 1) return sessionResult
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, delayMs)
      })
    }

    return authClient.getSession()
  }

  return {
    ...sessionState,
    user: sessionState.data?.user ?? null,
    session: sessionState.data?.session ?? null,
    signInWithEmail,
    signUpWithEmail,
    signOutCurrentUser,
    refreshSession,
  }
}
