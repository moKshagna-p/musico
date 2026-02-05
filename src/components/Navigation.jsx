import { NavLink, useNavigate } from 'react-router-dom'

const Navigation = () => {
  const navigate = useNavigate()

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

        <nav className="flex items-center gap-6 text-xs uppercase tracking-[0.4em] text-muted">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'text-white' : 'hover:text-white')}>
            Home
          </NavLink>
          <NavLink to="/discover" className={({ isActive }) => (isActive ? 'text-white' : 'hover:text-white')}>
            Discover
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export default Navigation
