import { Link } from 'react-router-dom'

const Hero = ({ albums = [] }) => {
  const heroAlbum = albums[0]

  return (
    <section className="rounded-3xl border border-outline bg-panel px-6 py-14 shadow-panel tablet:px-10">
      <p className="text-xs uppercase tracking-[0.4em] text-muted">Listening Room</p>
      <h1 className="mt-4 font-display text-4xl text-white laptop:text-5xl">
        Quiet interface. Just albums, ratings, and playback links.
      </h1>
      {heroAlbum && (
        <p className="mt-4 text-sm text-muted">
          Highlighting <span className="text-white">{heroAlbum.name}</span> by {heroAlbum.artists?.join(', ')}.
        </p>
      )}
      <div className="mt-6 flex gap-4 text-xs uppercase tracking-[0.4em]">
        <Link
          to="/discover"
          className="rounded-full border border-outline px-6 py-3 text-white transition hover:bg-white/5"
        >
          Discover
        </Link>
        <Link
          to="/discover?sort=rating"
          className="rounded-full border border-outline px-6 py-3 text-muted transition hover:text-white"
        >
          Highest Rated
        </Link>
      </div>
    </section>
  )
}

export default Hero
