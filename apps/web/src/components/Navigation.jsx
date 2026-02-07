import { NavLink, useNavigate } from 'react-router-dom'

const Navigation = () => {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 border-b border-outline/60 bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-3 font-display text-2xl tracking-[0.3em] text-white transition hover:opacity-80"
          aria-label="Go to Musico home"
        >
          <span
            className="inline-block h-[1.1em] w-[1.1em] animate-vinylSpin"
            aria-hidden="true"
          >
            <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_0_7px_rgba(255,255,255,0.35)]">
              <defs>
                <radialGradient id="vinylBody" cx="35%" cy="30%" r="80%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="35%" stopColor="#ededed" />
                  <stop offset="70%" stopColor="#cdcdcd" />
                  <stop offset="100%" stopColor="#9e9e9e" />
                </radialGradient>
                <linearGradient id="vinylShine" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                  <stop offset="45%" stopColor="#ffffff" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <clipPath id="vinylLabelClip">
                  <circle cx="50" cy="50" r="10.8" />
                </clipPath>
              </defs>

              <circle cx="50" cy="50" r="49" fill="url(#vinylBody)" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="#f6f6f6" strokeWidth="0.9" opacity="0.65" />
              <circle cx="50" cy="50" r="37" fill="none" stroke="#fefefe" strokeWidth="1.2" opacity="0.3" />
              <circle cx="50" cy="50" r="30" fill="none" stroke="#fbfbfb" strokeWidth="1.1" opacity="0.28" />
              <circle cx="50" cy="50" r="23" fill="none" stroke="#f6f6f6" strokeWidth="1" opacity="0.22" />
              <circle cx="50" cy="50" r="16" fill="none" stroke="#fefefe" strokeWidth="0.95" opacity="0.24" />
              <circle cx="50" cy="50" r="12.4" fill="#f8f8f8" opacity="0.9" />
              <image
                href="/mbdtf-cover.jpg"
                x="39.2"
                y="39.2"
                width="21.6"
                height="21.6"
                preserveAspectRatio="xMidYMid slice"
                clipPath="url(#vinylLabelClip)"
              />
              <circle cx="50" cy="50" r="10.8" fill="none" stroke="#ffffff" strokeWidth="0.9" opacity="0.55" />
              <circle cx="50" cy="50" r="2.1" fill="#d9d9d9" />

              <path
                d="M14 40 A36 36 0 0 1 40 14"
                fill="none"
                stroke="url(#vinylShine)"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <ellipse cx="33" cy="28" rx="10" ry="6" fill="#ffffff" opacity="0.35" />
            </svg>
          </span>
          musico
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
