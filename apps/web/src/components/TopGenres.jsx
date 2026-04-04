import { useMemo } from 'react'

const TopGenres = ({ ratedAlbums }) => {
  const topGenres = useMemo(() => {
    const genres = ratedAlbums.reduce((acc, album) => {
      const safeGenres = Array.isArray(album?.genres) ? album.genres : []
      safeGenres.forEach((genre) => {
        acc[genre] = (acc[genre] || 0) + 1
      })
      return acc
    }, {})
    return Object.entries(genres)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
  }, [ratedAlbums])

  return (
    <section className="my-16">
      <h2 className="mb-8 text-center font-display text-3xl font-bold tablet:text-4xl">Recent Top Genres</h2>
      <div className="text-center">
        {topGenres.map(([genre]) => (
          <p key={genre} className="text-base text-muted tablet:text-lg">
            {genre}
          </p>
        ))}
        {topGenres.length === 0 && <p className="text-base text-muted tablet:text-lg">No genres yet</p>}
      </div>
    </section>
  )
}

export default TopGenres
