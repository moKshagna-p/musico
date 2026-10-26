import { memo, useMemo } from 'react'

const Stats = ({ ratedAlbums, totalRated, averageRating }) => {
  const safeTotal = totalRated ?? ratedAlbums.length
  
  // Memoize expensive calculations
  const { avg, topArtistName } = useMemo(() => {
    const calculatedAvg = averageRating ?? (
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
    
    const calculatedTopArtistName = Object.keys(topArtist).length
      ? Object.keys(topArtist).reduce((a, b) => (topArtist[a] > topArtist[b] ? a : b))
      : 'N/A'
    
    return { avg: calculatedAvg, topArtistName: calculatedTopArtistName }
  }, [ratedAlbums, safeTotal, averageRating])

  const items = [
    { label: 'Albums rated', value: safeTotal },
    { label: 'Average rating', value: avg.toFixed(2) },
    { label: 'Recent top artist', value: topArtistName },
  ]

  return (
    <section className="my-14">
      <dl className="grid grid-cols-1 divide-y divide-white/[0.07] border-y border-white/[0.07] md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col-reverse gap-2 px-1 py-8 md:px-8 md:first:pl-0">
            <dt className="text-sm text-muted">{item.label}</dt>
            <dd className="break-words font-display text-5xl leading-none text-paper tablet:text-6xl">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default memo(Stats)
