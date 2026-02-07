import { useContext } from 'react'

import { RatingsContext } from '../context/RatingsContext.jsx'

export const useRatings = () => {
  const context = useContext(RatingsContext)
  if (!context) {
    throw new Error('useRatings must be used inside RatingsProvider')
  }
  return context
}
