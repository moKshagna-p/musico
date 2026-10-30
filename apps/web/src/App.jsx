import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'

import Footer from './components/ui/Footer.jsx'
import Navigation from './components/ui/Navigation.jsx'
import PageTransition from './components/ui/PageTransition.jsx'
import {
  AlbumDetailsPageSkeleton,
  AdminDashboardPageSkeleton,
  AuthPageSkeleton,
  DiscoverPageSkeleton,
  FeedPageSkeleton,
  ListeningHistoryPageSkeleton,
  NotFoundPageSkeleton,
  ProfilePageSkeleton,
  PublicListPageSkeleton,
  SearchResultsPageSkeleton,
} from './components/ui/PageLoadingState.jsx'
import RouteErrorBoundary from './components/ui/RouteErrorBoundary.jsx'
import { useAuth } from './hooks/useAuth.js'

// Home is the landing page: importing it statically avoids the extra
// network round trip for its chunk before the first render.
import Home from './pages/Home.jsx'

// React.lazy suspends on every first mount, even when the chunk is already downloaded, so a page that has its data
// (seeded from the card that linked to it) would still flash its skeleton. Once a page's chunk is in, it renders
// directly instead; album cards also need that to morph into the album page (utils/morph.js). Each mount picks once.
const lazyPage = (load) => {
  let Loaded = null
  const preload = () => load().then((module) => {
    Loaded = module.default
    return module
  })
  const Lazy = lazy(preload)
  const Page = () => {
    const [Component] = useState(() => Loaded ?? Lazy)
    return <Component />
  }
  Page.preload = preload
  return Page
}

const Discover = lazyPage(() => import('./pages/Discover.jsx'))
const SearchResults = lazyPage(() => import('./pages/SearchResults.jsx'))
const Profile = lazyPage(() => import('./pages/Profile.jsx'))
const ProfileHistory = lazyPage(() => import('./pages/ProfileHistory.jsx'))
const UserProfile = lazyPage(() => import('./pages/UserProfile.jsx'))
const Feed = lazyPage(() => import('./pages/Feed.jsx'))
const PublicList = lazyPage(() => import('./pages/PublicList.jsx'))
const Auth = lazyPage(() => import('./pages/Auth.jsx'))
const AlbumDetails = lazyPage(() => import('./pages/AlbumDetails.jsx'))
const NotFound = lazyPage(() => import('./pages/NotFound.jsx'))
const AdminDashboard = lazyPage(() => import('./pages/AdminDashboard.jsx'))
// Pages a visitor moves between, fetched once the first page has settled. Auth, admin and 404 load on demand.
const IDLE_PRELOADS = [AlbumDetails, PublicList, UserProfile, Profile, Feed, Discover, SearchResults, ProfileHistory]

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000
const LAST_ACTIVITY_KEY = 'musico:last-activity-at'

const withRouteFallback = (element, fallback, bleed = false) => (
  <Suspense
    fallback={(
      <PageTransition bleed={bleed}>
        {fallback}
      </PageTransition>
    )}
  >
    {element}
  </Suspense>
)

// Last scroll position per history entry, for back and forward.
const scrollPositions = new Map()

const App = () => {
  const location = useLocation()
  const navigationType = useNavigationType()
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
        navigate('/', { replace: true })
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

    // Throttle writes to localStorage to avoid excessive updates.
    let lastWrite = 0
    const touchLastActivityThrottled = () => {
      const now = Date.now()
      if (now - lastWrite < 15000) return
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
    window.addEventListener('keydown', touchLastActivityThrottled)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('pointerdown', touchLastActivityThrottled)
      window.removeEventListener('keydown', touchLastActivityThrottled)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isPending, user])

  useEffect(() => {
    const timer = setTimeout(() => IDLE_PRELOADS.forEach((page) => page.preload().catch(() => {})), 2000)
    return () => clearTimeout(timer)
  }, [])

  // Back and forward return to where you were on that page; anything else starts at the top. A layout effect, so
  // the page is already in place when a cover morph (utils/morph.js) snapshots it.
  useLayoutEffect(() => {
    const top = navigationType === 'POP' ? (scrollPositions.get(location.key) ?? 0) : 0
    let restoring = true
    const observer = new ResizeObserver(() => restore())
    const restore = () => {
      window.scrollTo({ top, left: 0, behavior: 'instant' })
      if (Math.abs(window.scrollY - top) <= 1) {
        restoring = false
        observer.disconnect()
      }
    }
    observer.observe(document.body)
    restore()
    // A loading page may be shorter than the saved position. Keep it until the content grows or the user scrolls.
    const save = () => { if (!restoring) scrollPositions.set(location.key, window.scrollY) }
    const cancel = () => { restoring = false; observer.disconnect() }
    const onKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancel()
    }
    window.addEventListener('scroll', save, { passive: true })
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchstart', cancel, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', save)
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [location.key, navigationType])

  return (
    // Framer Motion skips movement (keeps fades) for people who prefer reduced motion.
    <MotionConfig reducedMotion="user">
      <div className="isolate flex min-h-screen flex-col overflow-x-clip bg-canvas text-paper">
        <Navigation />
        <main className="flex-1">
          <RouteErrorBoundary>
            {/* Pages fade in on mount (PageTransition). No exit wait: a morph needs the new page in the DOM right away. */}
            <Routes location={location} key={location.pathname}>
              {/* Home is statically imported and never suspends; it renders its own skeleton while loading */}
              <Route path="/" element={<Home />} />
              <Route path="/discover" element={withRouteFallback(<Discover />, <DiscoverPageSkeleton />)} />
              <Route path="/search" element={withRouteFallback(<SearchResults />, <SearchResultsPageSkeleton />)} />
              <Route path="/profile" element={withRouteFallback(<Profile />, <ProfilePageSkeleton own />)} />
              <Route path="/profile/history" element={withRouteFallback(<ProfileHistory />, <ListeningHistoryPageSkeleton />)} />
              <Route path="/profile/:username" element={withRouteFallback(<UserProfile />, <ProfilePageSkeleton />)} />
              <Route path="/feed" element={withRouteFallback(<Feed />, <FeedPageSkeleton />)} />
              <Route path="/lists/:listId" element={withRouteFallback(<PublicList />, <PublicListPageSkeleton />)} />
              <Route path="/auth" element={withRouteFallback(<Auth />, <AuthPageSkeleton />)} />
              <Route path="/admin" element={withRouteFallback(<AdminDashboard />, <AdminDashboardPageSkeleton />)} />
              <Route path="/album/:albumId" element={withRouteFallback(<AlbumDetails />, <AlbumDetailsPageSkeleton />, true)} />
              <Route path="*" element={withRouteFallback(<NotFound />, <NotFoundPageSkeleton />)} />
            </Routes>
          </RouteErrorBoundary>
        </main>
        <Footer />
      </div>
    </MotionConfig>
  )
}

export default App
