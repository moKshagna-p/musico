const SEARCH_HISTORY_KEY = 'vaultSearchHistory'
const MAX_HISTORY_ITEMS = 10

const isBrowser = typeof window !== 'undefined'

export const getSearchHistory = () => {
  if (!isBrowser) return []
  try {
    const history = window.localStorage.getItem(SEARCH_HISTORY_KEY)
    return history ? JSON.parse(history) : []
  } catch {
    return []
  }
}

export const addToSearchHistory = (query) => {
  if (!isBrowser || !query?.trim()) return
  
  const history = getSearchHistory()
  const trimmedQuery = query.trim().toLowerCase()
  
  // Remove duplicates and add to front
  const filtered = history.filter(item => item !== trimmedQuery)
  const updated = [trimmedQuery, ...filtered].slice(0, MAX_HISTORY_ITEMS)
  
  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
  } catch (error) {
    console.warn('Unable to save search history', error)
  }
}

export const clearSearchHistory = () => {
  if (!isBrowser) return
  try {
    window.localStorage.removeItem(SEARCH_HISTORY_KEY)
  } catch (error) {
    console.warn('Unable to clear search history', error)
  }
}
