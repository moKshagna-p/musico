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

  return {
    ...sessionState,
    user: sessionState.data?.user ?? null,
    session: sessionState.data?.session ?? null,
    signInWithEmail,
    signUpWithEmail,
    signOutCurrentUser,
  }
}
