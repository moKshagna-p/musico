import { NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth.js'
import { useAdminAccess } from '../hooks/useAdminAccess.js'

const Navigation = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isAdmin } = useAdminAccess()

  return (
    <header className="sticky top-0 z-40 border-b border-outline/60 bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-3 py-3 tablet:gap-4 tablet:px-6 tablet:py-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex min-w-0 shrink items-center gap-2 font-sans text-base font-semibold tracking-[0.12em] text-white [font-variant-ligatures:none] transition hover:opacity-80 tablet:gap-3 tablet:text-2xl tablet:tracking-[0.24em]"
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
                <linearGradient id="vinylLabelFill" x1="39.2" y1="39.2" x2="60.8" y2="60.8">
                  <stop offset="0%" stopColor="#111111" />
                  <stop offset="100%" stopColor="#2b2b2b" />
                </linearGradient>
              </defs>

              <circle cx="50" cy="50" r="49" fill="url(#vinylBody)" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="#f6f6f6" strokeWidth="0.9" opacity="0.65" />
              <circle cx="50" cy="50" r="37" fill="none" stroke="#fefefe" strokeWidth="1.2" opacity="0.3" />
              <circle cx="50" cy="50" r="30" fill="none" stroke="#fbfbfb" strokeWidth="1.1" opacity="0.28" />
              <circle cx="50" cy="50" r="23" fill="none" stroke="#f6f6f6" strokeWidth="1" opacity="0.22" />
              <circle cx="50" cy="50" r="16" fill="none" stroke="#fefefe" strokeWidth="0.95" opacity="0.24" />
              <circle cx="50" cy="50" r="12.4" fill="#f8f8f8" opacity="0.9" />
              <circle cx="50" cy="50" r="10.8" fill="url(#vinylLabelFill)" />
              <text
                x="50"
                y="53.8"
                textAnchor="middle"
                fontSize="8.8"
                fontWeight="700"
                fill="#f5f5f5"
                clipPath="url(#vinylLabelClip)"
              >
                M
              </text>
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

        <nav className="flex min-w-0 shrink items-center gap-2 overflow-x-auto whitespace-nowrap text-[0.58rem] uppercase tracking-[0.12em] text-muted [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden tablet:gap-6 tablet:text-xs tablet:tracking-[0.35em]">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'text-white' : 'hover:text-white')}>
            Home
          </NavLink>
          <NavLink to="/discover" className={({ isActive }) => (isActive ? 'text-white' : 'hover:text-white')}>
            Discover
          </NavLink>
          {user && (
            <NavLink to="/feed" className={({ isActive }) => (isActive ? 'text-white' : 'hover:text-white')}>
              Feed
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'text-white' : 'hover:text-white')}>
              Admin
            </NavLink>
          )}
          {user ? (
            <NavLink to="/profile" className={({ isActive }) => (isActive ? 'text-white' : 'hover:text-white')}>
              Profile
            </NavLink>
          ) : (
            <NavLink to="/auth" className={({ isActive }) => (isActive ? 'text-white' : 'hover:text-white')}>
              Sign In
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Navigation
