import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

import {
  loadRatingsFromStorage,
  persistRating,
} from '../services/ratingsService.js'

export const RatingsContext = createContext(null)

export const RatingsProvider = ({ children }) => {
  const [ratings, setRatings] = useState({})

  useEffect(() => {
    setRatings(loadRatingsFromStorage())
  }, [])

  const rateAlbum = useCallback((albumId, rating) => {
    setRatings((prev) => {
      const next = {
        ...prev,
        [albumId]: {
          rating,
          timestamp: Date.now(),
        },
      }
      persistRating(albumId, rating)
      return next
    })
  }, [])

  const getUserRating = useCallback(
    (albumId) => ratings[albumId]?.rating ?? null,
    [ratings],
  )

  const getCommunityStats = useCallback(
    (album) => {
      if (!album) return { average: 0, total: 0 }
      const average = Number(album.communityRating)
      const total = Number(album.reviewCount)
      return {
        average: Number.isFinite(average) ? average : 0,
        total: Number.isFinite(total) ? total : 0,
      }
    },
    [],
  )

  const value = useMemo(
    () => ({
      ratings,
      rateAlbum,
      getUserRating,
      getCommunityStats,
    }),
    [ratings, rateAlbum, getUserRating, getCommunityStats],
  )

  return <RatingsContext.Provider value={value}>{children}</RatingsContext.Provider>
}
