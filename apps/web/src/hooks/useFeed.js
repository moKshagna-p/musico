import { useInfiniteQuery } from '@tanstack/react-query'
import api from '../services/apiClient.js'

/**
 * Professional Feed Hook using TanStack Query
 * Handles: Caching, SWR, Infinite Scroll, and Loading/Error states automatically.
 */
const useFeed = () => {
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
    queryKey: ['feed'],
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
