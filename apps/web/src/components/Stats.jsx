const Stats = ({ ratedAlbums, totalRated, averageRating }) => {
  const safeTotal = totalRated ?? ratedAlbums.length
  const avg = averageRating ?? (
    safeTotal > 0
      ? ratedAlbums.reduce((acc, album) => acc + Number(album?.rating || 0), 0) / safeTotal
      : 0
  )
  const topArtist = ratedAlbums.reduce(
    (acc, album) => {
      const artist = String(album?.artist ?? album?.artists?.[0] ?? '').trim()
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
          <p className="font-display text-4xl font-bold tablet:text-6xl">{safeTotal}</p>
          <p className="mt-2 text-base text-muted tablet:text-lg">Albums Rated</p>
        </div>
        <div>
          <p className="font-display text-4xl font-bold tablet:text-6xl">{avg.toFixed(2)}</p>
          <p className="mt-2 text-base text-muted tablet:text-lg">Average Rating</p>
        </div>
        <div>
          <p className="break-words font-display text-3xl font-bold tablet:text-5xl">{topArtistName}</p>
          <p className="mt-2 text-base text-muted tablet:text-lg">Recent Top Artist</p>
        </div>
      </div>
    </section>
  )
}

export default Stats
