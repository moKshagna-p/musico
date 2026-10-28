import { fetchMyBootstrap } from '../services/profileDataService.js'

// Started in main.jsx alongside get-session, so a signed-in page load gets
// ratings, lists and the admin flag without waiting for the session first.
export const meBootstrapQueryOptions = {
  queryKey: ['me-bootstrap'],
  queryFn: fetchMyBootstrap,
  staleTime: Infinity,
  retry: false,
}

// The bootstrap for this user, or null so callers fall back to their own
// endpoint. A cached result for someone else (e.g. the signed-out result from
// before signing in) is refetched once; concurrent callers share that request.
export const getMeBootstrap = async (queryClient, userId) => {
  try {
    let bootstrap = await queryClient.fetchQuery(meBootstrapQueryOptions)
    if (bootstrap?.userId !== userId) {
      bootstrap = await queryClient.fetchQuery({ ...meBootstrapQueryOptions, staleTime: 0 })
    }
    return bootstrap?.userId === userId ? bootstrap : null
  } catch {
    return null
  }
}
