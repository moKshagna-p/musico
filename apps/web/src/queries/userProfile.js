import { fetchUserProfile } from '../services/socialService.js'

// Profiles are read straight from the database, so a short staleTime keeps revisits instant
// while follows and new ratings still show up. useAuth clears the cache when the viewer changes.
export const userProfileQueryOptions = (username) => ({
  queryKey: ['user-profile', String(username ?? '').toLowerCase()],
  queryFn: () => fetchUserProfile(username),
  staleTime: 1000 * 60,
  retry: false,
})
