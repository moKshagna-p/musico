import { useEffect, useRef, useState } from 'react'
import { FiSearch, FiX, FiCommand, FiClock, FiCornerDownLeft } from 'react-icons/fi'
import { AnimatePresence, m } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

import { useSearch } from '../../hooks/useSearch.js'
import {
  addToSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeFromSearchHistory,
} from '../../services/searchHistoryService.js'

const HighlightMatch = ({ text, match }) => {
  if (!match || !text) return <>{text}</>
  const parts = text.split(new RegExp(`(${match.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === match.toLowerCase() ? (
          <span key={i} className="font-semibold text-paper">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

const SearchBar = ({
  query = '',
  onSearch,
  onValueChange,
  placeholder,
  autoFocus,
  historyScope = 'guest',
  enablePredictive = true,
  enableHistory = true,
}) => {
  const navigate = useNavigate()
  const MotionDiv = m.div
  const [value, setValue] = useState(query)
  const [syncedQuery, setSyncedQuery] = useState(query)
  const [pendingSubmittedQuery, setPendingSubmittedQuery] = useState(null)
  const [isFocused, setIsFocused] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const inputRef = useRef(null)
  
  // 1. Professional Fetching with local debouncing & cancellation
  const { suggestions, isLoading, isFetching } = useSearch(value, {
    enabled: enablePredictive && isFocused,
  })
  
  const [recentSearches, setRecentSearches] = useState([])

  // 2. Keyboard shortcut (Cmd + K)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  if (syncedQuery !== query) {
    setSyncedQuery(query)
    if (pendingSubmittedQuery !== query) setValue(query)
    if (pendingSubmittedQuery !== null) setPendingSubmittedQuery(null)
  }

  const submitSearch = (term) => {
    const trimmed = term?.trim() ?? ''
    if (!trimmed) return

    if (enableHistory) {
      addToSearchHistory(trimmed, historyScope)
    }
    if (trimmed !== query) setPendingSubmittedQuery(trimmed)
    onSearch?.(trimmed)
    setIsFocused(false)
    inputRef.current?.blur()
  }

  const applyValue = (nextValue) => {
    setValue(nextValue)
    onValueChange?.(nextValue)
  }

  const handleKeyDown = (e) => {
    const totalCount = enablePredictive ? suggestions.length : 0
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIndex(prev => (prev < totalCount - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : totalCount - 1))
    } else if (e.key === 'Enter') {
      if (enablePredictive && activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
        e.preventDefault()
        const item = suggestions[activeSuggestionIndex]
        navigate(`/album/${item.id}`)
        setIsFocused(false)
      } else {
        submitSearch(value)
      }
    } else if (e.key === 'Escape') {
      setIsFocused(false)
      inputRef.current?.blur()
    }
  }

  const showSuggestions = enablePredictive && value.length >= 3
  const showRecentSearches = enableHistory && recentSearches.length > 0 && value.length < 3
  const showDropdown = isFocused && (showSuggestions || showRecentSearches)

  return (
    <div
      className="relative z-50"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false)
      }}
    >
      <div
        className={`relative flex items-center gap-3 rounded-full border px-5 py-3.5 backdrop-blur-xl transition-all duration-300 tablet:py-4 ${
          isFocused
            ? 'border-white/30 bg-white/[0.06] shadow-[0_0_0_6px_rgba(238,234,227,0.05)]'
            : 'border-white/10 bg-white/[0.03] hover:border-white/20'
        }`}
      >
        <FiSearch aria-hidden="true" className={`shrink-0 text-lg transition-colors ${isFocused ? 'text-paper' : 'text-muted'}`} />

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            const nextValue = e.target.value
            applyValue(nextValue)
            setActiveSuggestionIndex(-1)
          }}
          onFocus={() => {
            setIsFocused(true)
            setRecentSearches(enableHistory ? getSearchHistory(historyScope) : [])
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Search music, artists, vibes...'}
          aria-label="Search music"
          autoFocus={autoFocus}
          className="min-w-0 flex-1 bg-transparent text-base text-paper placeholder:text-muted focus:outline-none focus-visible:outline-none tablet:text-lg"
        />

        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => applyValue('')}
              className="rounded-full p-1 text-muted hover:text-paper"
            >
              <FiX />
            </button>
          )}
          <kbd className="hidden items-center gap-0.5 rounded-md border border-white/10 px-1.5 py-0.5 font-sans text-[11px] text-muted md:flex">
            <FiCommand aria-hidden="true" /> K
          </kbd>
        </div>
      </div>

      <AnimatePresence>
        {showDropdown && (
          <MotionDiv
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-3xl border border-white/10 bg-black/80 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
          >
            {/* Quick Results */}
            {showSuggestions && (
              <div className="p-2">
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-xs font-bold text-muted">Suggestions</p>
                  {(isLoading || isFetching) && (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  )}
                </div>
                
                {suggestions.length > 0 ? (
                  <div className="space-y-1">
                    {suggestions.map((item, i) => (
                      <button
                        key={item.id}
                        onClick={() => navigate(`/album/${item.id}`)}
                        onMouseEnter={() => setActiveSuggestionIndex(i)}
                        className={`flex w-full items-center gap-4 rounded-xl p-2 text-left transition-colors ${
                          activeSuggestionIndex === i ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <img 
                          src={item.cover} 
                          alt="" 
                          className="h-11 w-11 rounded-[3px] bg-white/5 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white/90">
                            <HighlightMatch text={item.name} match={value} />
                          </p>
                          <p className="truncate text-xs text-muted">
                            <HighlightMatch text={item.artists?.join(', ')} match={value} />{item.releaseYear ? `, ${item.releaseYear}` : ''}
                          </p>
                        </div>
                        {activeSuggestionIndex === i && (
                          <FiCornerDownLeft className="text-muted opacity-50" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : !isLoading && (
                  <p className="px-3 py-4 text-center text-sm text-muted">No matches found.</p>
                )}
              </div>
            )}

            {/* Recent Searches */}
            {showRecentSearches && (
              <div className="p-2">
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-xs font-bold text-muted text-center">Recent Searches</p>
                  <button
                    type="button"
                    aria-label="Clear recent searches"
                    onClick={(e) => {
                      e.stopPropagation()
                      clearSearchHistory(historyScope)
                      setRecentSearches([])
                    }}
                    className="text-xs font-bold text-muted hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-1 space-y-1">
                  {recentSearches.map((term) => (
                    <div key={term} className="group flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/5 transition-colors">
                      <button
                        type="button"
                        onClick={() => submitSearch(term)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                        aria-label={`Search ${term}`}
                      >
                        <FiClock className="shrink-0 text-muted" />
                        <span className="truncate text-sm text-white/80">{term}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${term} from recent searches`}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFromSearchHistory(term, historyScope)
                          setRecentSearches(getSearchHistory(historyScope))
                        }}
                        className="p-1 text-muted opacity-0 transition-all hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                      >
                        <FiX />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  )
}

export default SearchBar
