import { useContext } from 'react'

import { RatingsContext } from '../context/ratingsContext.js'

export const useRatings = () => {
  const context = useContext(RatingsContext)
  if (!context) {
    throw new Error('useRatings must be used inside RatingsProvider')
  }
  return context
}
