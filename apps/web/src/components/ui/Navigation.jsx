import { motion } from 'framer-motion'
import { useId } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth.js'

const MotionSpan = motion.span

// Grooves alternate two tones so the disc keeps its texture at favicon size; solid colours render the same everywhere.
const GROOVES = [8.6, 9.15, 9.7, 10.25, 10.8, 11.35, 11.9, 12.45, 13, 13.55, 14.1, 14.65]

export const MusicoMark = ({ className = '' }) => {
  const id = useId()
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id={`${id}d`} cx="16" cy="16" r="15.5" gradientUnits="userSpaceOnUse">
          <stop offset="0.45" stopColor="#1a1a19" />
          <stop offset="1" stopColor="#070707" />
        </radialGradient>
        <linearGradient id={`${id}a`} x1="6.47" y1="10.5" x2="16.96" y2="5.04" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="25.53" y1="21.5" x2="15.04" y2="26.96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15.5" fill={`url(#${id}d)`} />
      <g fill="none" strokeWidth="0.25">
        {GROOVES.map((r, i) => <circle key={r} cx="16" cy="16" r={r} stroke={i % 3 ? '#222221' : '#2e2e2d'} />)}
      </g>
      <path d="M16 16 2.58 8.25A15.5 15.5 0 0 1 17.35 .56Z" fill={`url(#${id}a)`} />
      <path d="M16 16 29.42 23.75A15.5 15.5 0 0 1 14.65 31.44Z" fill={`url(#${id}b)`} />
      <circle cx="16" cy="16" r="15.25" fill="none" stroke="#3a3a38" strokeWidth="0.5" />
      <circle cx="16" cy="16" r="6.3" fill="#eeeae3" />
      <circle cx="16" cy="16" r="4.6" fill="none" stroke="#d6d2cb" strokeWidth="0.35" />
      <circle cx="16" cy="16" r="1" fill="#070707" />
    </svg>
  )
}

const DockLink = ({ to, end, children }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `relative shrink-0 rounded-full px-2 py-1.5 text-[13px] transition-colors sm:px-3 tablet:px-4 ${isActive ? 'text-paper' : 'text-muted hover:text-paper'}`
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <MotionSpan
            layoutId="dock-active"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="absolute inset-0 rounded-full bg-white/[0.09] ring-1 ring-inset ring-white/[0.08]"
          />
        )}
        <span className="relative">{children}</span>
      </>
    )}
  </NavLink>
)

const Navigation = () => {
  const { user } = useAuth()

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 tablet:pt-4">
      <div className="mx-auto flex w-fit max-w-full items-center gap-1 rounded-full border border-white/[0.08] bg-black/55 p-1.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl backdrop-saturate-150">
        <Link
          to="/"
          aria-label="Go to Musico home"
          className="group flex shrink-0 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-1 sm:pr-3"
        >
          <MusicoMark className="h-7 w-7 transition-transform duration-700 group-hover:rotate-[200deg]" />
          <span className="hidden font-display text-lg leading-none text-paper sm:inline">musico</span>
        </Link>

        <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-white/10" />

        <nav className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <DockLink to="/" end>Home</DockLink>
          <DockLink to="/discover">Discover</DockLink>
          {user && <DockLink to="/feed">Feed</DockLink>}
          {user ? (
            <DockLink to="/profile">Profile</DockLink>
          ) : (
            <NavLink
              to="/auth"
              className="ml-1 shrink-0 rounded-full bg-paper px-4 py-1.5 text-[13px] font-medium text-black transition-opacity hover:opacity-85"
            >
              Sign In
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Navigation
