import { useContext } from 'react'

import { ListsContext } from '../context/listsContext.js'

export const useLists = () => {
  const context = useContext(ListsContext)
  if (!context) {
    throw new Error('useLists must be used inside ListsProvider')
  }
  return context
}
