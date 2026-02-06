import { useEffect, useMemo, useState } from 'react'
import { FiArrowLeft, FiClock } from 'react-icons/fi'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import RatingStars from '../components/RatingStars.jsx'
import StreamingLinks from '../components/StreamingLinks.jsx'
import { useRatings } from '../hooks/useRatings.js'
import { getReleaseDetails } from '../services/discogsService.js'
import { formatDuration, formatLargeNumber, formatReleaseDate, generateStreamingLinks } from '../utils/helpers.js'

const AlbumDetails = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { albumId } = useParams()
  const { rateAlbum, getUserRating, getCommunityStats } = useRatings()

  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true
    const fetchAlbum = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await getReleaseDetails(albumId)
        if (isMounted) setAlbum(result)
      } catch (err) {
        if (isMounted) setError(err?.message ?? 'Unable to load album details.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchAlbum()
    return () => {
      isMounted = false
    }
  }, [albumId])

  const streamingLinks = useMemo(() => generateStreamingLinks(album), [album])
  const userRating = getUserRating(album?.id ?? '')
  const community = album ? getCommunityStats(album) : { average: 0, total: 0 }

  const goBack = () => {
    const from = location.state?.from
    const query = location.state?.query
    
    if (from === '/search' && query) {
      navigate(`/search?q=${encodeURIComponent(query)}`)
    } else if (from === '/discover') {
      navigate('/discover')
    } else if (from === '/') {
      navigate('/')
    } else {
      navigate('/discover')
    }
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="grid gap-8 tablet:grid-cols-[340px,1fr]">
          <div className="h-[420px] rounded-3xl bg-white/5" />
          <div className="space-y-4">
            <div className="h-10 w-1/2 rounded-full bg-white/10" />
            <div className="h-6 w-1/3 rounded-full bg-white/10" />
            <div className="space-y-2">
              <div className="h-4 rounded-full bg-white/5" />
              <div className="h-4 rounded-full bg-white/5" />
            </div>
          </div>
        </div>
      </PageTransition>
    )
  }

  if (error) {
    return (
      <PageTransition>
        <div className="rounded-3xl border border-white/5 bg-red-500/10 px-6 py-8 text-center text-red-200">
          <p className="font-semibold">{error}</p>
          <button
            type="button"
            onClick={goBack}
            className="mt-4 rounded-full border border-red-200/30 px-4 py-2 text-xs uppercase tracking-[0.3em]"
          >
            Go Back
          </button>
        </div>
      </PageTransition>
    )
  }

  if (!album) return null

  return (
    <PageTransition>
      <button
        type="button"
        onClick={goBack}
        className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-muted hover:text-white"
      >
        <FiArrowLeft /> Back
      </button>

      <div className="grid gap-12 tablet:grid-cols-[350px,1fr]">
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-outline bg-panel p-2">
            <img src={album.cover} alt={album.name} className="rounded-2xl object-cover" />
          </div>

          <StreamingLinks links={streamingLinks} />
        </div>

        <div className="space-y-8">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-muted">Album</p>
            <h1 className="font-display text-4xl">{album.name}</h1>
            <p className="text-lg text-muted">{album.artists.join(', ')}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted">
              {formatReleaseDate(album.releaseDate, album.releaseYear)}
            </p>
          </div>

          <div className="grid gap-4 rounded-3xl border border-outline bg-panel p-6 tablet:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted">Community Avg</p>
              <p className="text-4xl font-semibold text-white">{community.average?.toFixed(1)}</p>
              <p className="text-xs text-muted">{formatLargeNumber(community.total)} listeners</p>
            </div>
            <div className="flex items-center justify-end">
              <RatingStars value={userRating ?? community.average} onRate={(value) => rateAlbum(album.id, value)} showValue />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-muted">Tracklist</p>
            <div className="mt-4 divide-y divide-outline rounded-3xl border border-outline bg-panel/70">
              {album.tracks?.map((track) => (
                <div key={track.id ?? track.track_number} className="flex items-center justify-between px-4 py-3 text-sm text-muted">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted">{track.track_number}</span>
                    <span className="text-white">{track.name}</span>
                  </div>
                  <span className="flex items-center gap-2 text-muted">
                    <FiClock />
                    {formatDuration(track.duration_ms)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs uppercase tracking-[0.4em] text-muted">No extra commentary. Just track data.</p>
        </div>
      </div>
    </PageTransition>
  )
}

export default AlbumDetails
