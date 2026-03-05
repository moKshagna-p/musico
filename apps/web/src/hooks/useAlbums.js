import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { searchReleases } from '../services/discogsService.js'
import { debounce } from '../utils/helpers.js'

export const useAlbums = (initialQuery = '') => {
  const skipNextSearchEffectRef = useRef(false)
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(Boolean(initialQuery?.trim()))
  const [error, setError] = useState(null)
  const [query, setQuery] = useState(initialQuery)
  const [correctedQuery, setCorrectedQuery] = useState(null)

  const searchHandler = useMemo(
    () =>
      debounce(async (value) => {
      const trimmed = value?.trim() ?? ''
      if (!trimmed) {
        setAlbums([])
        setLoading(false)
        setError(null)
        setCorrectedQuery(null)
        return
      }

      setLoading(true)
      setError(null)
      setCorrectedQuery(null)
      try {
        const result = await searchReleases(trimmed)
        setAlbums(result.data)
        setCorrectedQuery(result.correctedQuery)
      } catch (err) {
        setError(err?.message ?? 'Search is unavailable at the moment.')
        setAlbums([])
        setCorrectedQuery(null)
      } finally {
        setLoading(false)
      }
      }, 300),
    [],
  )

  const runSearchImmediately = useCallback(async (value) => {
    const trimmed = value?.trim() ?? ''
    if (!trimmed) {
      setAlbums([])
      setLoading(false)
      setError(null)
      setCorrectedQuery(null)
      return
    }

    setLoading(true)
    setError(null)
    setCorrectedQuery(null)
    try {
      const result = await searchReleases(trimmed)
      setAlbums(result.data)
      setCorrectedQuery(result.correctedQuery)
    } catch (err) {
      setError(err?.message ?? 'Search is unavailable at the moment.')
      setAlbums([])
      setCorrectedQuery(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const trimmed = query?.trim() ?? ''
    if (trimmed) {
      skipNextSearchEffectRef.current = true
      void runSearchImmediately(trimmed)
    } else {
      setLoading(false)
      setAlbums([])
    }
    // Run once on mount so /search?q=... restores immediately without a featured-data flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (skipNextSearchEffectRef.current) {
      skipNextSearchEffectRef.current = false
      return
    }
    searchHandler(query)
  }, [query, searchHandler])

  return {
    albums,
    query,
    setQuery,
    loading,
    error,
    correctedQuery,
  }
}
