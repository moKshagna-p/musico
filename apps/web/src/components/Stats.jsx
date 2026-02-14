const Stats = ({ ratedAlbums }) => {
  const totalAlbumsRated = ratedAlbums.length
  const safeTotal = totalAlbumsRated || 1
  const averageRating =
    ratedAlbums.reduce((acc, album) => acc + Number(album?.rating || 0), 0) / safeTotal
  const topArtist = ratedAlbums.reduce(
    (acc, album) => {
      const artist = String(album?.artist ?? '').trim()
      if (!artist) return acc
      acc[artist] = (acc[artist] || 0) + 1
      return acc
    },
    {},
  )
  const topArtistName = Object.keys(topArtist).length
    ? Object.keys(topArtist).reduce((a, b) => (topArtist[a] > topArtist[b] ? a : b))
    : 'N/A'

  return (
    <section className="my-16">
      <div className="grid grid-cols-1 gap-8 text-center md:grid-cols-3">
        <div>
          <p className="font-serif text-6xl font-bold">{totalAlbumsRated}</p>
          <p className="mt-2 text-lg text-muted">Albums Rated</p>
        </div>
        <div>
          <p className="font-serif text-6xl font-bold">{averageRating.toFixed(2)}</p>
          <p className="mt-2 text-lg text-muted">Average Rating</p>
        </div>
        <div>
          <p className="font-serif text-6xl font-bold">{topArtistName}</p>
          <p className="mt-2 text-lg text-muted">Top Artist</p>
        </div>
      </div>
    </section>
  )
}

export default Stats
