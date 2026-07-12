import { useInfiniteQuery } from '@tanstack/react-query'
import api from '../services/apiClient.js'
import { useAuth } from './useAuth.js'

/**
 * Professional Feed Hook using TanStack Query
 * Handles: Caching, SWR, Infinite Scroll, and Loading/Error states automatically.
 */
const useFeed = () => {
  const { user, isPending } = useAuth()
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', user?.id ?? null],
    queryFn: async ({ pageParam = null }) => {
      const response = await api.get('/api/me/feed', {
        params: {
          cursor: pageParam,
          limit: 20,
        },
      })
      return response // Axios interceptor already returns response.data
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: null,
    enabled: !isPending && Boolean(user?.id),
  })

  // Flatten the pages into a single items array
  const items = data?.pages.flatMap((page) => page.data) ?? []

  return {
    items,
    loading: isLoading,
    loadingMore: isFetchingNextPage,
    error: isError ? error.message : null,
    hasMore: !!hasNextPage,
    loadMore: fetchNextPage,
    refresh: refetch,
  }
}

export default useFeed
