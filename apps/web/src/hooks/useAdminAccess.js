import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from './useAuth.js'
import { fetchAdminMe } from '../services/adminService.js'
import { getMeBootstrap } from '../queries/meBootstrap.js'

export const useAdminAccess = () => {
  const { user, isPending } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['admin-me', user?.id ?? null]

  const adminQuery = useQuery({
    queryKey,
    // The first load comes from the startup bootstrap; refetches and
    // invalidations ask /admin/me directly so role changes show up.
    queryFn: async () => {
      if (queryClient.getQueryData(queryKey) === undefined) {
        const bootstrap = await getMeBootstrap(queryClient, user?.id)
        if (bootstrap) return { isAdmin: bootstrap.isAdmin }
      }
      return fetchAdminMe()
    },
    enabled: !isPending && Boolean(user?.id),
    staleTime: 1000 * 60,
    retry: 0,
  })

  return {
    isAdmin: Boolean(adminQuery.data?.isAdmin),
    loadingAdmin: adminQuery.isLoading && Boolean(user?.id),
    refetchAdmin: adminQuery.refetch,
  }
}
