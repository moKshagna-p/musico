/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../hooks/useAuth.js'
import { deleteMyRating, fetchMyRatings, saveMyRating } from '../services/profileDataService.js'
import { updateAlbumCommunityStatsInCache } from '../services/discogsService.js'

export const RatingsContext = createContext(null)

export const RatingsProvider = ({ children }) => {
  const { user, isPending } = useAuth()
  const queryClient = useQueryClient()
  const [ratings, setRatings] = useState({})
  const [loadingRatings, setLoadingRatings] = useState(true)

  useEffect(() => {
    let isCancelled = false

    const loadRatings = async () => {
      setLoadingRatings(true)
      setRatings({})
      if (isPending) return
      if (!user?.id) {
        setRatings({})
        setLoadingRatings(false)
        return
      }

      try {
        const remoteRatings = await fetchMyRatings()
        if (!isCancelled) {
          setRatings(remoteRatings)
        }
      } catch {
        if (!isCancelled) {
          setRatings({})
        }
      } finally {
        if (!isCancelled) {
          setLoadingRatings(false)
        }
      }
    }

    void loadRatings()

    return () => {
      isCancelled = true
    }
  }, [isPending, user?.id])

  const rateAlbum = useCallback((albumId, rating, meta = {}) => {
    if (!user?.id) return

    const normalizedAlbumId = String(albumId ?? '').trim()
    const numericRating = Number(rating)
    const normalizedRating = Math.min(5, Math.max(0.5, Math.round((Number.isFinite(numericRating) ? numericRating : 0) * 2) / 2))
    if (!normalizedAlbumId || !normalizedRating) return

    const existingRating = Number(ratings[normalizedAlbumId]?.rating ?? 0)
    const shouldClear = Math.abs(existingRating - normalizedRating) < 0.001
    const timestamp = Date.now()
    setRatings((prev) => {
      if (shouldClear) {
        const next = { ...prev }
        delete next[normalizedAlbumId]
        return next
      }

      return {
        ...prev,
        [normalizedAlbumId]: {
          rating: normalizedRating,
          timestamp,
        },
      }
    })

    const request = shouldClear
      ? deleteMyRating(normalizedAlbumId)
      : saveMyRating(normalizedAlbumId, normalizedRating, meta)

    void request
      .then((saved) => {
        setRatings((prev) => {
          const savedRating = Number(saved?.rating)
          if (!Number.isFinite(savedRating) || savedRating <= 0) {
            const next = { ...prev }
            delete next[normalizedAlbumId]
            return next
          }

          return {
            ...prev,
            [normalizedAlbumId]: {
              rating: savedRating,
              timestamp: Number(saved?.timestamp ?? timestamp),
            },
          }
        })

        const nextCommunityRating = Number(saved?.communityRating)
        const nextReviewCount = Number(saved?.reviewCount)
        if (Number.isFinite(nextCommunityRating) && Number.isFinite(nextReviewCount)) {
          updateAlbumCommunityStatsInCache({
            albumId: normalizedAlbumId,
            communityRating: nextCommunityRating,
            reviewCount: nextReviewCount,
          })

          queryClient.setQueryData(['release', normalizedAlbumId], (current) =>
            current
              ? {
                  ...current,
                  communityRating: nextCommunityRating,
                  reviewCount: nextReviewCount,
                }
              : current,
          )

          queryClient.setQueriesData({ queryKey: ['search'] }, (current) => {
            if (!current?.data || !Array.isArray(current.data)) return current

            return {
              ...current,
              data: current.data.map((album) =>
                String(album?.id) === normalizedAlbumId
                  ? {
                      ...album,
                      communityRating: nextCommunityRating,
                      reviewCount: nextReviewCount,
                    }
                  : album,
              ),
            }
          })
        }

      })
      .catch(() => {
        setRatings((prev) => {
          if (shouldClear) {
            return {
              ...prev,
              [normalizedAlbumId]: {
                rating: normalizedRating,
                timestamp,
              },
            }
          }

          return {
            ...prev,
            [normalizedAlbumId]: {
              rating: existingRating,
              timestamp: Number(ratings[normalizedAlbumId]?.timestamp ?? timestamp),
            },
          }
        })
      })
  }, [user?.id, queryClient, ratings])

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
      loadingRatings,
      rateAlbum,
      getUserRating,
      getCommunityStats,
    }),
    [ratings, loadingRatings, rateAlbum, getUserRating, getCommunityStats],
  )

  return <RatingsContext.Provider value={value}>{children}</RatingsContext.Provider>
}
