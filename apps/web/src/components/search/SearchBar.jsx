import { useEffect, useRef, useState } from 'react'
import { FiSearch, FiX, FiCommand, FiClock, FiCornerDownLeft } from 'react-icons/fi'
import { AnimatePresence, motion } from 'framer-motion'
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
          <span key={i} className="font-black text-white">{part}</span>
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
  const MotionDiv = motion.div
  const [value, setValue] = useState(query)
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

  useEffect(() => {
    setValue(query)
  }, [query])

  useEffect(() => {
    if (!enableHistory) {
      setRecentSearches([])
      return
    }

    setRecentSearches(getSearchHistory(historyScope))
  }, [enableHistory, historyScope, isFocused])

  const submitSearch = (term) => {
    const trimmed = term?.trim() ?? ''
    if (!trimmed) return

    if (enableHistory) {
      addToSearchHistory(trimmed, historyScope)
    }
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
    <div className="relative z-50">
      <div 
        className={`relative flex items-center gap-3 rounded-2xl border transition-all duration-300 ${
          isFocused 
            ? 'border-white/40 bg-panel shadow-[0_0_0_4px_rgba(255,255,255,0.05)]' 
            : 'border-outline bg-panel/60 hover:border-outline-hover'
        } p-4`}
      >
        <FiSearch className={`text-xl transition-colors ${isFocused ? 'text-white' : 'text-muted'}`} />
        
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            const nextValue = e.target.value
            applyValue(nextValue)
            setActiveSuggestionIndex(-1)
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Search music, artists, vibes...'}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent text-base text-white placeholder:text-muted/60 focus:outline-none"
        />

        <div className="flex items-center gap-2">
          {value && (
            <button 
              onClick={() => applyValue('')}
              className="p-1 text-muted hover:text-white"
            >
              <FiX />
            </button>
          )}
          <div className="hidden items-center gap-1 rounded-md border border-outline bg-canvas/50 px-1.5 py-0.5 text-[10px] font-bold text-muted tablet:flex">
            <FiCommand /> K
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDropdown && (
          <MotionDiv
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-outline bg-panel/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Quick Results */}
            {showSuggestions && (
              <div className="p-2">
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted">Suggestions</p>
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
                          activeSuggestionIndex === i ? 'bg-white/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <img 
                          src={item.cover} 
                          alt="" 
                          className="h-10 w-10 rounded-lg object-cover bg-black/40"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white/90">
                            <HighlightMatch text={item.name} match={value} />
                          </p>
                          <p className="truncate text-xs text-muted">
                            <HighlightMatch text={item.artists?.join(', ')} match={value} /> • {item.releaseYear}
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted text-center">Recent Searches</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      clearSearchHistory(historyScope)
                      setRecentSearches([])
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-1 space-y-1">
                  {recentSearches.map((term) => (
                    <div key={term} className="group flex items-center justify-between rounded-xl px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => applyValue(term)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <FiClock className="shrink-0 text-muted" />
                        <span className="truncate text-sm text-white/80">{term}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFromSearchHistory(term, historyScope)
                          setRecentSearches(getSearchHistory(historyScope))
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition-all"
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
