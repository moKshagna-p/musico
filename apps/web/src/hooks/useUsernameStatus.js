import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { checkUsernameAvailability } from '../services/socialService.js'

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/

export const USERNAME_STATUS_TEXT = {
  checking: 'Checking...',
  available: 'Available',
  taken: 'Already taken',
  invalid: '3-24 chars, lowercase letters, numbers, hyphens',
  error: 'Unable to check username. Please retry.',
}

export const cleanUsername = (value) => value.toLowerCase().replace(/[^a-z0-9-]/g, '')

export const useUsernameStatus = (username) => {
  const [debouncedUsername, setDebouncedUsername] = useState('')
  const valid = USERNAME_REGEX.test(username)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUsername(username), 400)
    return () => clearTimeout(timer)
  }, [username])

  const query = useQuery({
    queryKey: ['username-availability', debouncedUsername],
    queryFn: ({ signal }) => checkUsernameAvailability(debouncedUsername, { signal }),
    enabled: valid && username === debouncedUsername,
    retry: 1,
    staleTime: 0,
  })

  let status = null
  if (username) {
    if (!valid) status = 'invalid'
    else if (username !== debouncedUsername || query.isFetching || query.isPending) status = 'checking'
    else if (query.isError) status = 'error'
    else status = !query.data.valid ? 'invalid' : query.data.available ? 'available' : 'taken'
  }
  return { status, retry: query.refetch }
}
