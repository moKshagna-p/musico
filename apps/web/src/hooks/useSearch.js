import { useQuery } from '@tanstack/react-query'
import { searchReleases } from '../services/discogsService.js'
import { useEffect, useState } from 'react'

/**
 * Professional Search Hook
 * Handles: Debouncing, Request Cancellation, and Deduplication via TanStack Query.
 */
export const useSearch = (query, { enabled = true, limit = 5, offset = 0, minLength = 3 } = {}) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  // 1. Debounce the query locally to avoid firing requests on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // 2. Use TanStack Query for the actual fetching
  // It automatically handles request cancellation (if we use the signal) 
  // and deduplication.
  const queryResult = useQuery({
    queryKey: ['search', debouncedQuery, limit, offset],
    queryFn: async ({ signal }) => {
      if (!debouncedQuery || debouncedQuery.length < minLength) {
        return { data: [], correctedQuery: null, hasMore: false, nextOffset: null, total: 0 }
      }
      
      return searchReleases(debouncedQuery, { signal, limit, offset })
    },
    enabled: enabled && debouncedQuery.length >= minLength,
    staleTime: 1000 * 60 * 5, // Cache search results for 5 minutes
  })

  return {
    ...queryResult,
    suggestions: queryResult.data?.data ?? [],
    correctedQuery: queryResult.data?.correctedQuery ?? null,
    hasMore: Boolean(queryResult.data?.hasMore),
    nextOffset: queryResult.data?.nextOffset ?? null,
    total: queryResult.data?.total ?? 0,
  }
}
