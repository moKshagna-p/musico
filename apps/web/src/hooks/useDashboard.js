import { useQuery } from '@tanstack/react-query'
import { validatedRequest } from '../services/apiClient.js'

/**
 * Hook to fetch batched dashboard data (ratings, lists, profile info)
 * Reduces 3 HTTP requests to 1 for better initial load performance
 */
export const useDashboard = () => {
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await validatedRequest({ url: '/api/me/dashboard' })
      return response?.data ?? response ?? {}
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  })

  return {
    dashboard: dashboardQuery.data,
    isLoading: dashboardQuery.isLoading,
    isFetching: dashboardQuery.isFetching,
    error: dashboardQuery.error,
    refetch: dashboardQuery.refetch,
  }
}
