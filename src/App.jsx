import { AnimatePresence } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'

import Footer from './components/Footer.jsx'
import Navigation from './components/Navigation.jsx'
import AlbumDetails from './pages/AlbumDetails.jsx'
import Discover from './pages/Discover.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'

const App = () => {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-canvas text-white">
      <Navigation />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname + location.search}>
          <Route path="/" element={<Home />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/album/:albumId" element={<AlbumDetails />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
      <Footer />
    </div>
  )
}

export default App
