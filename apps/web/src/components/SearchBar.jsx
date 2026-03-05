import { useEffect, useRef, useState } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'

import { searchReleases } from '../services/discogsService.js'
import {
  addToSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeFromSearchHistory,
} from '../services/searchHistoryService.js'

const MIN_SUGGEST_QUERY_LENGTH = 3
const SUGGESTION_LIMIT = 5

const SearchBar = ({
  query = '',
  onSearch,
  onValueChange,
  placeholder,
  autoFocus,
  enablePredictive = false,
  historyScope = 'guest',
  enableHistory = true,
}) => {
  const [value, setValue] = useState(query)
  const [recentSearches, setRecentSearches] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const latestRequestIdRef = useRef(0)
  const suggestionsCacheRef = useRef(new Map())

  useEffect(() => {
    setValue(query)
  }, [query])

  useEffect(() => {
    if (!enableHistory) {
      setRecentSearches([])
      return
    }
    setRecentSearches(getSearchHistory(historyScope))
  }, [enableHistory, historyScope])

  useEffect(() => {
    if (!enablePredictive) {
      setSuggestions([])
      setIsSuggesting(false)
      return
    }

    const trimmed = value.trim()
    if (trimmed.length < MIN_SUGGEST_QUERY_LENGTH) {
      setSuggestions([])
      setIsSuggesting(false)
      setActiveSuggestionIndex(-1)
      return
    }

    const cacheKey = trimmed.toLowerCase()
    const cachedSuggestions = suggestionsCacheRef.current.get(cacheKey)
    if (cachedSuggestions) {
      setSuggestions(cachedSuggestions)
      setIsSuggesting(false)
      setActiveSuggestionIndex(-1)
      return
    }

    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId
    setIsSuggesting(true)

    const timer = setTimeout(async () => {
      try {
        const result = await searchReleases(trimmed)
        if (latestRequestIdRef.current !== requestId) return

        const nextSuggestions = (result.data ?? result)
          .slice(0, SUGGESTION_LIMIT)
          .map((item) => ({
            id: item.id,
            title: item.name,
            artist: item.artists?.[0] ?? 'Unknown artist',
          }))

        suggestionsCacheRef.current.set(cacheKey, nextSuggestions)
        setSuggestions(nextSuggestions)
        setActiveSuggestionIndex(-1)
      } catch {
        if (latestRequestIdRef.current === requestId) {
          setSuggestions([])
          setActiveSuggestionIndex(-1)
        }
      } finally {
        if (latestRequestIdRef.current === requestId) {
          setIsSuggesting(false)
        }
      }
    }, 120)

    return () => clearTimeout(timer)
  }, [enablePredictive, value])

  const submitSearch = (rawValue) => {
    const trimmed = rawValue?.trim() ?? ''
    if (!trimmed) {
      onSearch?.('')
      return
    }

    if (enableHistory) {
      addToSearchHistory(trimmed, historyScope)
      setRecentSearches(getSearchHistory(historyScope))
    }
    onSearch?.(trimmed)
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
  }

  const submitSuggestion = (item) => {
    if (!item) return
    const term = `${item.artist} ${item.title}`.trim()
    setValue(term)
    submitSearch(term)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    submitSearch(value)
  }

  const handleKeyDown = (event) => {
    if (!shouldShowSuggestions || !suggestions.length) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSuggestionIndex((prev) => (prev < 0 ? 0 : (prev + 1) % suggestions.length))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSuggestionIndex((prev) => (prev < 0 ? suggestions.length - 1 : prev <= 0 ? suggestions.length - 1 : prev - 1))
      return
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault()
      submitSuggestion(suggestions[activeSuggestionIndex])
      return
    }

    if (event.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
    }
  }

  const handleRecentSearchClick = (term) => {
    setValue(term)
    submitSearch(term)
  }

  const handleDeleteRecentSearch = (term) => {
    if (!enableHistory) return
    removeFromSearchHistory(term, historyScope)
    setRecentSearches(getSearchHistory(historyScope))
  }

  const handleClearHistory = () => {
    if (!enableHistory) return
    clearSearchHistory(historyScope)
    setRecentSearches([])
  }

  const shouldShowSuggestions = enablePredictive && showSuggestions && value.trim().length >= MIN_SUGGEST_QUERY_LENGTH

  return (
    <div className="rounded-3xl border border-outline bg-panel p-4 tablet:p-6">
      <div className="relative">
        <form onSubmit={handleSubmit} className="flex items-center gap-3 border-b border-outline pb-4 tablet:gap-4">
          <FiSearch className="text-xl text-muted" />
          <input
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value
              setValue(nextValue)
              onValueChange?.(nextValue)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? 'Search albums or artists'}
            autoFocus={autoFocus}
            className="flex-1 bg-transparent text-base text-white placeholder:text-muted focus:outline-none tablet:text-lg"
          />
          <button type="submit" className="text-[0.64rem] uppercase tracking-[0.22em] text-muted hover:text-white tablet:text-xs tablet:tracking-[0.4em]">
            Search
          </button>
        </form>

        {shouldShowSuggestions && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.65rem)] z-20 rounded-2xl border border-outline bg-canvas/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur">
            {isSuggesting ? (
              <p className="px-3 py-2 text-xs uppercase tracking-[0.32em] text-muted">Finding matches...</p>
            ) : suggestions.length > 0 ? (
              suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveSuggestionIndex(suggestions.findIndex((entry) => entry.id === item.id))}
                  onClick={() => submitSuggestion(item)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                    suggestions[activeSuggestionIndex]?.id === item.id ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="truncate text-sm text-white">{item.title}</span>
                  <span className="max-w-28 truncate pl-3 text-xs uppercase tracking-[0.2em] text-muted tablet:max-w-none">{item.artist}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs uppercase tracking-[0.32em] text-muted">No quick matches yet.</p>
            )}
          </div>
        )}
      </div>

      {enableHistory && (
        <div className="mt-5 rounded-2xl border border-outline/80 bg-canvas/25 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.34em] text-muted">
            Recent Searches
            {recentSearches.length > 0 ? ` (${recentSearches.length})` : ''}
          </p>
          {recentSearches.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-[0.65rem] uppercase tracking-[0.26em] text-muted transition hover:text-white"
            >
              Clear all
            </button>
          )}
        </div>

        {recentSearches.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs text-muted">
            {recentSearches.map((term) => (
              <div
                key={term}
                className="group inline-flex items-center rounded-full border border-outline bg-panel px-3 py-1.5 text-[0.7rem]"
              >
                <button
                  type="button"
                  onClick={() => handleRecentSearchClick(term)}
                  className="max-w-28 truncate text-left text-muted transition group-hover:text-white tablet:max-w-44"
                  title={term}
                >
                  {term}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRecentSearch(term)}
                  className="ml-2 rounded-full p-0.5 text-muted transition hover:bg-white/10 hover:text-white"
                  aria-label={`Delete ${term} from recent searches`}
                >
                  <FiX className="text-[0.65rem]" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-outline px-4 py-5 text-center">
            <p className="text-sm text-muted">No recent searches yet.</p>
            <p className="mt-1 text-xs text-muted/80">Search an artist or album to start building history.</p>
          </div>
        )}
        </div>
      )}
    </div>
  )
}

export default SearchBar
