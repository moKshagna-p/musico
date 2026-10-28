import { useEffect, useState } from 'react'

import { checkUsernameAvailability } from '../services/socialService.js'

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/

export const USERNAME_STATUS_TEXT = {
  checking: 'Checking...',
  available: 'Available',
  taken: 'Already taken',
  invalid: '3-24 chars, lowercase letters, numbers, hyphens',
}

export const cleanUsername = (value) => value.toLowerCase().replace(/[^a-z0-9-]/g, '')

// null | 'checking' | 'available' | 'taken' | 'invalid', debounced against /api/username/check.
export const useUsernameStatus = (username) => {
  const [checked, setChecked] = useState({ username: '', status: null })
  const valid = USERNAME_REGEX.test(username)

  useEffect(() => {
    if (!valid) return
    const timer = setTimeout(async () => {
      const result = await checkUsernameAvailability(username)
      setChecked({ username, status: !result.valid ? 'invalid' : result.available ? 'available' : 'taken' })
    }, 400)
    return () => clearTimeout(timer)
  }, [username, valid])

  if (!username) return null
  if (!valid) return 'invalid'
  return checked.username === username ? checked.status : 'checking'
}
