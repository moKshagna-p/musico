import { AnimatePresence } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'

import Footer from './components/Footer.jsx'
import Navigation from './components/Navigation.jsx'
import AlbumDetails from './pages/AlbumDetails.jsx'
import Discover from './pages/Discover.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'
import SearchResults from './pages/SearchResults.jsx'

const App = () => {
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-white">
      <Navigation />
      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/search" element={<SearchResults />} />
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
