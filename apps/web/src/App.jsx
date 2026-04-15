import { lazy, Suspense, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import Footer from './components/Footer.jsx'
import Navigation from './components/Navigation.jsx'
import PageTransition from './components/PageTransition.jsx'
import {
  AlbumDetailsPageSkeleton,
  AuthPageSkeleton,
  DiscoverPageSkeleton,
  FeedPageSkeleton,
  HomePageSkeleton,
  NotFoundPageSkeleton,
  ProfilePageSkeleton,
  PublicListPageSkeleton,
  SearchResultsPageSkeleton,
} from './components/PageLoadingState.jsx'
import RouteErrorBoundary from './components/RouteErrorBoundary.jsx'
import { useAuth } from './hooks/useAuth.js'

const Home = lazy(() => import('./pages/Home.jsx'))
const Discover = lazy(() => import('./pages/Discover.jsx'))
const SearchResults = lazy(() => import('./pages/SearchResults.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const UserProfile = lazy(() => import('./pages/UserProfile.jsx'))
const Feed = lazy(() => import('./pages/Feed.jsx'))
const PublicList = lazy(() => import('./pages/PublicList.jsx'))
const Auth = lazy(() => import('./pages/Auth.jsx'))
const AlbumDetails = lazy(() => import('./pages/AlbumDetails.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000
const LAST_ACTIVITY_KEY = 'musico:last-activity-at'

const withRouteFallback = (element, fallback) => (
  <Suspense
    fallback={(
      <PageTransition>
        {fallback}
      </PageTransition>
    )}
  >
    {element}
  </Suspense>
)

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
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search])

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-white">
      <Navigation />
      <main className="flex-1">
        <RouteErrorBoundary>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={withRouteFallback(<Home />, <HomePageSkeleton />)} />
              <Route path="/discover" element={withRouteFallback(<Discover />, <DiscoverPageSkeleton />)} />
              <Route path="/search" element={withRouteFallback(<SearchResults />, <SearchResultsPageSkeleton />)} />
              <Route path="/profile" element={withRouteFallback(<Profile />, <ProfilePageSkeleton showActions />)} />
              <Route path="/profile/:username" element={withRouteFallback(<UserProfile />, <ProfilePageSkeleton withBackButton />)} />
              <Route path="/feed" element={withRouteFallback(<Feed />, <FeedPageSkeleton />)} />
              <Route path="/lists/:listId" element={withRouteFallback(<PublicList />, <PublicListPageSkeleton />)} />
              <Route path="/auth" element={withRouteFallback(<Auth />, <AuthPageSkeleton />)} />
              <Route path="/album/:albumId" element={withRouteFallback(<AlbumDetails />, <AlbumDetailsPageSkeleton />)} />
              <Route path="*" element={withRouteFallback(<NotFound />, <NotFoundPageSkeleton />)} />
            </Routes>
          </AnimatePresence>
        </RouteErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}

export default App
