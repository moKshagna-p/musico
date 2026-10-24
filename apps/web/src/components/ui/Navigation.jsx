import { motion } from 'framer-motion'
import { Link, NavLink } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth.js'
import { useAdminAccess } from '../../hooks/useAdminAccess.js'

const MotionSpan = motion.span

export const MusicoMark = ({ className = '' }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
    <circle cx="16" cy="16" r="15.5" fill="#0b0b0b" stroke="rgba(255,255,255,0.16)" />
    <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.09)" />
    <circle cx="16" cy="16" r="9" fill="none" stroke="rgba(255,255,255,0.09)" />
    <path d="M5.5 11 A11.5 11.5 0 0 1 11 5.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="16" cy="16" r="5.6" fill="#eeeae3" />
    <circle cx="16" cy="16" r="1.2" fill="#0b0b0b" />
  </svg>
)

const DockLink = ({ to, end, children }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `relative shrink-0 rounded-full px-3 py-1.5 text-[13px] transition-colors tablet:px-4 ${isActive ? 'text-paper' : 'text-muted hover:text-paper'}`
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
  const { isAdmin } = useAdminAccess()

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
          {isAdmin && <DockLink to="/admin">Admin</DockLink>}
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
