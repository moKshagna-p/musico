import AlbumCard from './AlbumCard.jsx'
import LoadingSkeleton from './LoadingSkeleton.jsx'

const AlbumGrid = ({ albums = [], loading, error, onSelect }) => {
  if (error) {
    return (
      <div className="rounded-3xl border border-outline bg-panel px-6 py-8 text-center text-muted">
        {error}
      </div>
    )
  }

  if (!loading && !albums.length) {
    return (
      <div className="rounded-3xl border border-outline bg-panel px-6 py-8 text-center">
        <p className="text-sm uppercase tracking-[0.28em] text-muted">No results found</p>
        <p className="mt-2 text-sm text-muted">Try a different artist, album title, or broader keyword.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 tablet:grid-cols-2 laptop:grid-cols-3">
      {loading ? (
        <LoadingSkeleton count={6} />
      ) : (
        albums.map((album) => <AlbumCard key={album.id} album={album} onSelect={onSelect} />)
      )}
    </div>
  )
}

export default AlbumGrid
