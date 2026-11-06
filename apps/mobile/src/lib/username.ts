import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { checkUsername } from './api'

// Same rules and copy as the web (hooks/useUsernameStatus.js).
const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/
export const STATUS_TEXT: Record<string, string> = {
  checking: 'Checking...',
  available: 'Available',
  taken: 'Already taken',
  invalid: '3-24 chars, lowercase letters, numbers, hyphens',
  error: 'Unable to check username. Please retry.',
}
export const cleanUsername = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, '')

export const useUsernameStatus = (username: string) => {
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(username), 400)
    return () => clearTimeout(timer)
  }, [username])
  const valid = USERNAME_REGEX.test(username)
  const query = useQuery({ queryKey: ['username-availability', debounced], queryFn: () => checkUsername(debounced), enabled: valid && username === debounced, staleTime: 0 })
  let status: string | null = null
  if (username) {
    if (!valid) status = 'invalid'
    else if (username !== debounced || query.isFetching || query.isPending) status = 'checking'
    else if (query.isError) status = 'error'
    else status = !query.data?.valid ? 'invalid' : query.data.available ? 'available' : 'taken'
  }
  return { status, retry: () => void query.refetch() }
}

