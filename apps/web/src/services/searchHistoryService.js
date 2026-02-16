const SEARCH_HISTORY_KEY_PREFIX = 'vaultSearchHistory'
const MAX_HISTORY_ITEMS = 10

const isBrowser = typeof window !== 'undefined'

const normalizeQuery = (query) => query?.trim().toLowerCase() ?? ''
const normalizeScope = (scope) => {
  const normalized = String(scope ?? 'guest').trim().toLowerCase()
  return normalized || 'guest'
}
const getSearchHistoryKey = (scope) => `${SEARCH_HISTORY_KEY_PREFIX}:${normalizeScope(scope)}`

export const getSearchHistory = (scope = 'guest') => {
  if (!isBrowser) return []
  try {
    const history = window.localStorage.getItem(getSearchHistoryKey(scope))
    const parsed = history ? JSON.parse(history) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const addToSearchHistory = (query, scope = 'guest') => {
  if (!isBrowser || !query?.trim()) return

  const history = getSearchHistory(scope)
  const trimmedQuery = query.trim()
  const normalized = normalizeQuery(trimmedQuery)

  const filtered = history.filter((item) => normalizeQuery(item) !== normalized)
  const updated = [trimmedQuery, ...filtered].slice(0, MAX_HISTORY_ITEMS)

  try {
    window.localStorage.setItem(getSearchHistoryKey(scope), JSON.stringify(updated))
  } catch (error) {
    console.warn('Unable to save search history', error)
  }
}

export const removeFromSearchHistory = (query, scope = 'guest') => {
  if (!isBrowser || !query?.trim()) return

  const history = getSearchHistory(scope)
  const normalized = normalizeQuery(query)
  const updated = history.filter((item) => normalizeQuery(item) !== normalized)

  try {
    window.localStorage.setItem(getSearchHistoryKey(scope), JSON.stringify(updated))
  } catch (error) {
    console.warn('Unable to remove search history item', error)
  }
}

export const clearSearchHistory = (scope = 'guest') => {
  if (!isBrowser) return
  try {
    window.localStorage.removeItem(getSearchHistoryKey(scope))
  } catch (error) {
    console.warn('Unable to clear search history', error)
  }
}
