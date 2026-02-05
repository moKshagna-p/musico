import { useCallback, useEffect, useState } from 'react'

import { getFeaturedReleases, searchReleases } from '../services/discogsService.js'
import { debounce } from '../utils/helpers.js'

export const useAlbums = (initialQuery = '') => {
  const [albums, setAlbums] = useState([])
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState(initialQuery)

  const fetchReleases = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const releases = await getFeaturedReleases(36)
      setAlbums(releases)
      setFeatured(releases.slice(0, 3))
    } catch (err) {
      setError(err?.message ?? 'Unable to load featured releases.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReleases()
  }, [fetchReleases])

  const searchHandler = useCallback(
    debounce(async (value) => {
      if (!value) {
        await fetchReleases()
        return
      }
      setLoading(true)
      setError(null)
      try {
        const results = await searchReleases(value)
        setAlbums(results)
      } catch (err) {
        setError(err?.message ?? 'Search is unavailable at the moment.')
      } finally {
        setLoading(false)
      }
    }, 420),
    [fetchReleases],
  )

  useEffect(() => {
    searchHandler(query)
  }, [query, searchHandler])

  return {
    albums,
    featuredAlbums: featured,
    query,
    setQuery,
    loading,
    error,
  }
}
