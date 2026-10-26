import { memo, useMemo } from 'react'

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

  const max = topGenres[0]?.[1] ?? 1

  return (
    <section className="my-14 grid gap-6 md:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="font-display text-3xl leading-none text-paper tablet:text-4xl">Recent Top Genres</h2>
        <p className="mt-2 text-sm text-muted">From your latest ratings.</p>
      </div>
      <ol className="space-y-3">
        {topGenres.map(([genre, count]) => (
          <li key={genre} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-4 text-sm">
            <span className="truncate text-paper">{genre}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <span className="block h-full rounded-full bg-paper/80" style={{ width: `${(count / max) * 100}%` }} />
            </span>
            <span className="text-right text-muted">{count}</span>
          </li>
        ))}
        {topGenres.length === 0 && <li className="text-sm text-muted">No genres yet. Rate a few albums to see your mix.</li>}
      </ol>
    </section>
  )
}

export default memo(TopGenres)
