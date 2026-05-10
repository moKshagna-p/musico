import { useEffect, useRef, useState } from 'react'

/**
 * Hook to detect when user scrolls to the bottom of a list
 * Useful for infinite scroll or "Load More" functionality
 */
export const useInfiniteScroll = (callback, options = {}) => {
  const { threshold = 0.1, rootMargin = '100px', enabled = true } = options
  const observerTarget = useRef(null)
  const callbackRef = useRef(callback)
  const loadingRef = useRef(false)
  const wasIntersectingRef = useRef(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) {
      wasIntersectingRef.current = false
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          wasIntersectingRef.current = false
          return
        }

        if (wasIntersectingRef.current || loadingRef.current) return

        wasIntersectingRef.current = true
        loadingRef.current = true
        setIsLoading(true)

        Promise.resolve(callbackRef.current?.())
          .catch(() => undefined)
          .finally(() => {
            loadingRef.current = false
            setIsLoading(false)
          })
      })
    }, {
      threshold,
      rootMargin,
    })

    const target = observerTarget.current
    if (target) {
      observer.observe(target)
    }

    return () => {
      observer.disconnect()
    }
  }, [enabled, rootMargin, threshold])

  return { observerTarget, isLoading }
}
