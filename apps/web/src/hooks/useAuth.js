import { authClient } from '../services/authClient.js'

export const useAuth = () => {
  const sessionState = authClient.useSession()

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

  const signOutCurrentUser = async () => authClient.signOut()
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
