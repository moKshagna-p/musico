import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import Footer from './components/Footer.jsx'
import Navigation from './components/Navigation.jsx'
import { useAuth } from './hooks/useAuth.js'
import AlbumDetails from './pages/AlbumDetails.jsx'
import Auth from './pages/Auth.jsx'
import Discover from './pages/Discover.jsx'
import Feed from './pages/Feed.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'
import Profile from './pages/Profile.jsx'
import PublicList from './pages/PublicList.jsx'
import PublicProfile from './pages/PublicProfile.jsx'
import SearchResults from './pages/SearchResults.jsx'

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000
const LAST_ACTIVITY_KEY = 'musico:last-activity-at'

const App = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isPending, signOutCurrentUser } = useAuth()

  useEffect(() => {
    if (isPending || !user) return

    const enforceInactivityTimeout = async () => {
      const lastActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) ?? 0)
      const hasTimedOut = lastActivity > 0 && Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS

      if (hasTimedOut) {
        window.localStorage.removeItem(LAST_ACTIVITY_KEY)
        await signOutCurrentUser()
        navigate('/auth', { replace: true })
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void enforceInactivityTimeout()
      }
    }

    const onWindowFocus = () => {
      void enforceInactivityTimeout()
    }

    void enforceInactivityTimeout()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onWindowFocus)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onWindowFocus)
    }
  }, [isPending, user, signOutCurrentUser, navigate])

  useEffect(() => {
    if (isPending || !user) return

    const touchLastActivity = () => {
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    }

    // Throttle writes to localStorage to avoid excessive updates for high-frequency events.
    let lastWrite = 0
    const touchLastActivityThrottled = () => {
      const now = Date.now()
      if (now - lastWrite < 10000) return
      lastWrite = now
      touchLastActivity()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        touchLastActivity()
      }
    }

    touchLastActivity()
    window.addEventListener('pointerdown', touchLastActivityThrottled, { passive: true })
    window.addEventListener('keydown', touchLastActivityThrottled, { passive: true })
    window.addEventListener('scroll', touchLastActivityThrottled, { passive: true })
    window.addEventListener('mousemove', touchLastActivityThrottled, { passive: true })
    window.addEventListener('touchstart', touchLastActivityThrottled, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('pointerdown', touchLastActivityThrottled)
      window.removeEventListener('keydown', touchLastActivityThrottled)
      window.removeEventListener('scroll', touchLastActivityThrottled)
      window.removeEventListener('mousemove', touchLastActivityThrottled)
      window.removeEventListener('touchstart', touchLastActivityThrottled)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isPending, user])

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-white">
      <Navigation />
      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/u/:username" element={<PublicProfile />} />
            <Route path="/lists/:listId" element={<PublicList />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/album/:albumId" element={<AlbumDetails />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}

export default App
