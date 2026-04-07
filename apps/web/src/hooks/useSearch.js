import { useQuery } from '@tanstack/react-query'
import { searchReleases } from '../services/discogsService.js'
import { useEffect, useState } from 'react'

/**
 * Professional Search Hook
 * Handles: Debouncing, Request Cancellation, and Deduplication via TanStack Query.
 */
export const useSearch = (query, { enabled = true, limit = 5 } = {}) => {
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
    queryKey: ['search', debouncedQuery, limit],
    queryFn: async ({ signal }) => {
      if (!debouncedQuery || debouncedQuery.length < 3) {
        return { data: [], correctedQuery: null }
      }
      
      return searchReleases(debouncedQuery, { signal })
    },
    enabled: enabled && debouncedQuery.length >= 3,
    staleTime: 1000 * 60 * 5, // Cache search results for 5 minutes
  })

  return {
    ...queryResult,
    suggestions: queryResult.data?.data?.slice(0, limit) ?? [],
    correctedQuery: queryResult.data?.correctedQuery ?? null,
  }
}
