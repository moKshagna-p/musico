import { useQuery } from '@tanstack/react-query'

import { useAuth } from './useAuth.js'
import { fetchAdminMe } from '../services/adminService.js'

export const useAdminAccess = () => {
  const { user, isPending } = useAuth()

  const adminQuery = useQuery({
    queryKey: ['admin-me', user?.id ?? null],
    queryFn: fetchAdminMe,
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
