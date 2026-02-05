import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'

const Navigation = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [term, setTerm] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setTerm(params.get('query') ?? '')
  }, [location.search])

  const handleSubmit = (event) => {
    event.preventDefault()
    const destination = term ? `/discover?query=${encodeURIComponent(term)}` : '/discover'
    navigate(destination)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-outline/60 bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-display text-2xl tracking-[0.3em] text-white transition hover:opacity-80"
        >
          MuseVault
        </button>

        <nav className="hidden items-center gap-8 text-xs uppercase tracking-[0.4em] text-muted md:flex">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'text-white' : 'hover:text-white')}>
            Home
          </NavLink>
          <NavLink to="/discover" className={({ isActive }) => (isActive ? 'text-white' : 'hover:text-white')}>
            Discover
          </NavLink>
        </nav>

        <form
          onSubmit={handleSubmit}
          className="hidden items-center gap-3 rounded-full border border-outline bg-panel px-4 py-2 text-sm text-muted md:flex"
        >
          <FiSearch />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search"
            className="w-36 bg-transparent text-sm text-white placeholder:text-muted focus:outline-none"
          />
        </form>

        <button
          type="button"
          onClick={() => navigate('/discover')}
          className="rounded-full border border-outline px-4 py-2 text-xs uppercase tracking-[0.4em] text-white hover:bg-white/5"
        >
          Browse
        </button>
      </div>
    </header>
  )
}

export default Navigation
