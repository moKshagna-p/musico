import { useEffect, useState } from 'react'
import { FiSearch } from 'react-icons/fi'

const trendingQueries = ['Cosmic Soul', 'Modular Jazz', 'Berlin Club', 'Alt-R&B', 'Ambient Strings']

const SearchBar = ({ query = '', onSearch, placeholder, autoFocus }) => {
  const [value, setValue] = useState(query)

  useEffect(() => {
    setValue(query)
  }, [query])

  const handleSubmit = (event) => {
    event.preventDefault()
    onSearch?.(value)
  }

  return (
    <div className="rounded-3xl border border-outline bg-panel p-6">
      <form onSubmit={handleSubmit} className="flex items-center gap-4 border-b border-outline pb-4">
        <FiSearch className="text-xl text-muted" />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder ?? "Search albums or artists"}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent text-lg text-white placeholder:text-muted focus:outline-none"
        />
        <button type="submit" className="text-xs uppercase tracking-[0.4em] text-muted hover:text-white">
          Search
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.4em] text-muted">
        {trendingQueries.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => {
              setValue(tag)
              onSearch?.(tag)
            }}
            className="rounded-full border border-outline px-3 py-1 text-[0.6rem] hover:text-white"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SearchBar
