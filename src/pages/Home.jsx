import { Link, useNavigate } from 'react-router-dom'

import AlbumGrid from '../components/AlbumGrid.jsx'
import Hero from '../components/Hero.jsx'
import PageTransition from '../components/PageTransition.jsx'
import { useAlbums } from '../hooks/useAlbums.js'

const Home = () => {
  const navigate = useNavigate()
  const { albums, featuredAlbums, loading, error } = useAlbums()

  return (
    <PageTransition>
      <Hero albums={featuredAlbums} />

      <div className="mt-12 space-y-10">

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted">Premiere Lineup</p>
              <h2 className="font-display text-3xl">New Rituals</h2>
            </div>
            <Link
              to="/discover"
              className="text-xs uppercase tracking-[0.5em] text-muted transition hover:text-white"
            >
              See all
            </Link>
          </div>
          <AlbumGrid albums={albums.slice(0, 6)} loading={loading} error={error} onSelect={(id) => navigate(`/album/${id}`)} />
        </section>

        <section className="rounded-3xl border border-outline bg-panel p-6 text-sm text-muted">
          <p>MuseVault is pared-back on purpose. No gradients, just music metadata.</p>
        </section>
      </div>
    </PageTransition>
  )
}

export default Home
