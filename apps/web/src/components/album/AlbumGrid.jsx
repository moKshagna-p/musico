import AlbumCard from './AlbumCard.jsx'
import LoadingSkeleton from '../ui/LoadingSkeleton.jsx'

export const ALBUM_GRID_CLASS = 'grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4 tablet:gap-x-8 tablet:gap-y-14'

const AlbumGrid = ({ albums = [], loading, error, onSelect, correctedQuery }) => {
  if (error) {
    return (
      <div className="rounded-2xl border border-white/[0.07] px-6 py-10 text-center text-sm text-muted">
        {error}
      </div>
    )
  }

  if (!loading && !albums.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
        <p className="font-display text-2xl text-paper">Nothing in this crate</p>
        <p className="mt-2 text-sm text-muted">Try a different artist, album title, or broader keyword.</p>
      </div>
    )
  }

  return (
    <div>
      {correctedQuery && !loading && albums.length > 0 && (
        <p className="mb-6 text-sm text-muted">
          Showing results for{' '}
          <span className="font-medium text-paper">"{correctedQuery}"</span>
        </p>
      )}
      <div className={ALBUM_GRID_CLASS}>
        {loading ? (
          <LoadingSkeleton count={8} />
        ) : (
          albums.map((album) => (
            <AlbumCard
              key={`${album.id ?? 'album'}-${album.name ?? 'untitled'}-${(album.artists ?? []).join('|')}-${album.releaseYear ?? 'year'}`}
              album={album}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default AlbumGrid
