const SEARCH_HISTORY_KEY = 'vaultSearchHistory'
const MAX_HISTORY_ITEMS = 10

const isBrowser = typeof window !== 'undefined'

const normalizeQuery = (query) => query?.trim().toLowerCase() ?? ''

export const getSearchHistory = () => {
  if (!isBrowser) return []
  try {
    const history = window.localStorage.getItem(SEARCH_HISTORY_KEY)
    const parsed = history ? JSON.parse(history) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const addToSearchHistory = (query) => {
  if (!isBrowser || !query?.trim()) return

  const history = getSearchHistory()
  const trimmedQuery = query.trim()
  const normalized = normalizeQuery(trimmedQuery)

  const filtered = history.filter((item) => normalizeQuery(item) !== normalized)
  const updated = [trimmedQuery, ...filtered].slice(0, MAX_HISTORY_ITEMS)

  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
  } catch (error) {
    console.warn('Unable to save search history', error)
  }
}

export const removeFromSearchHistory = (query) => {
  if (!isBrowser || !query?.trim()) return

  const history = getSearchHistory()
  const normalized = normalizeQuery(query)
  const updated = history.filter((item) => normalizeQuery(item) !== normalized)

  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
  } catch (error) {
    console.warn('Unable to remove search history item', error)
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
