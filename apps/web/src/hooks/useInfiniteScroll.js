import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Hook to detect when user scrolls to the bottom of a list
 * Useful for infinite scroll or "Load More" functionality
 */
export const useInfiniteScroll = (callback, options = {}) => {
  const { threshold = 0.1, rootMargin = '100px' } = options
  const observerTarget = useRef(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleIntersection = useCallback(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isLoading) {
          setIsLoading(true)
          callback?.()
            .then(() => setIsLoading(false))
            .catch(() => setIsLoading(false))
        }
      })
    },
    [callback, isLoading]
  )

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin,
    })

    const target = observerTarget.current
    if (target) {
      observer.observe(target)
    }

    return () => {
      if (target) {
        observer.unobserve(target)
      }
    }
  }, [handleIntersection])

  return { observerTarget, isLoading }
}
