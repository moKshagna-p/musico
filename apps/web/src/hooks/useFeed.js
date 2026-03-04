import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchMyFeed } from '../services/socialService.js'

const useFeed = () => {
  const [items, setItems] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  // Initial load
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchMyFeed({ limit: 20 })
        if (!cancelled) {
          setItems(result.items)
          setNextCursor(result.nextCursor)
        }
      } catch (err) {
        if (!cancelled) setError(err?.message ?? 'Failed to load feed.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // Polling for new items every 60s
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const result = await fetchMyFeed({ limit: 20 })
        setItems(result.items)
        setNextCursor(result.nextCursor)
      } catch {
        // Silently fail polling
      }
    }, 60_000)

    return () => clearInterval(pollRef.current)
  }, [])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await fetchMyFeed({ cursor: nextCursor, limit: 20 })
      setItems((prev) => [...prev, ...result.items])
      setNextCursor(result.nextCursor)
    } catch {
      // ignore
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, loadingMore])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchMyFeed({ limit: 20 })
      setItems(result.items)
      setNextCursor(result.nextCursor)
    } catch (err) {
      setError(err?.message ?? 'Failed to refresh feed.')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore: Boolean(nextCursor),
    loadMore,
    refresh,
  }
}

export default useFeed
