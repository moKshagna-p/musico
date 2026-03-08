import { useContext } from 'react'

import { ListsContext } from '../context/ListsContext.jsx'

export const useLists = () => {
  const context = useContext(ListsContext)
  if (!context) {
    throw new Error('useLists must be used inside ListsProvider')
  }
  return context
}
