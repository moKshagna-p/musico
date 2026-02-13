import { useEffect, useMemo, useState } from 'react'
import { FiArrowLeft, FiCheck, FiClock, FiPlus } from 'react-icons/fi'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'
import RatingStars from '../components/RatingStars.jsx'
import StreamingLinks from '../components/StreamingLinks.jsx'
import { useLists } from '../hooks/useLists.js'
import { useRatings } from '../hooks/useRatings.js'
import { getReleaseDetails } from '../services/discogsService.js'
import { formatDuration, formatLargeNumber, formatReleaseDate, generateStreamingLinks } from '../utils/helpers.js'

const AlbumDetails = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { albumId } = useParams()
  const { lists, createList, toggleAlbumInList, getListsContainingAlbum } = useLists()
  const { rateAlbum, getUserRating, getCommunityStats } = useRatings()

  const [album, setAlbum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newListName, setNewListName] = useState('')
  const [listStatus, setListStatus] = useState('')

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
  const albumSummary = useMemo(
    () => ({
      id: album?.id,
      name: album?.name,
      cover: album?.cover,
      artists: album?.artists,
      releaseYear: album?.releaseYear,
    }),
    [album],
  )
  const listsContainingAlbum = useMemo(
    () => new Set(getListsContainingAlbum(album?.id ?? '')),
    [album?.id, getListsContainingAlbum],
  )

  useEffect(() => {
    setListStatus('')
    setNewListName('')
  }, [album?.id])

  const handleCreateList = (event) => {
    event.preventDefault()
    const result = createList(newListName)

    if (!result.ok) {
      if (result.reason === 'duplicate') {
        setListStatus('A list with this name already exists.')
      } else if (result.reason === 'limit') {
        setListStatus('You reached the list limit. Remove one list to create another.')
      } else {
        setListStatus('Enter a list name to continue.')
      }
      return
    }

    setNewListName('')
    const toggleResult = toggleAlbumInList(result.list.id, albumSummary)
    if (toggleResult.ok && toggleResult.added) {
      setListStatus(`Created ${result.list.name} and added this album.`)
    } else {
      setListStatus(`Created ${result.list.name}.`)
    }
  }

  const handleToggleList = (listId) => {
    const result = toggleAlbumInList(listId, albumSummary)
    if (!result.ok) {
      setListStatus('Unable to update list right now.')
      return
    }

    setListStatus(result.added ? `Added to ${result.listName}.` : `Removed from ${result.listName}.`)
  }

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
            className="mt-4 rounded-full border border-red-200/30 px-4 py-2 text-xs uppercase tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
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
        className="mb-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-muted transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <FiArrowLeft aria-hidden="true" /> Back
      </button>

      <div className="grid gap-12 tablet:grid-cols-[350px,1fr]">
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-outline bg-panel p-2">
            <img src={album.cover} alt={album.name} width="640" height="640" className="rounded-2xl object-cover" />
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
            <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted">
              Community {community.average?.toFixed(1)} • {formatLargeNumber(community.total)} ratings
            </p>
          </div>

          <div className="grid gap-5 rounded-3xl border border-outline bg-panel p-6 tablet:grid-cols-[0.9fr,1.1fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted">Community Avg</p>
              <p className="text-4xl font-semibold tabular-nums text-white">{community.average?.toFixed(1)}</p>
              <p className="text-xs text-muted">{formatLargeNumber(community.total)} ratings</p>

              <div className="mt-6 border-t border-outline pt-5">
                <p className="text-xs uppercase tracking-[0.34em] text-muted">Your Rating</p>
                <div className="mt-2 flex items-center">
                  <RatingStars
                    value={userRating ?? 0}
                    onRate={(value) => rateAlbum(album.id, value)}
                    showValue
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-outline/90 bg-canvas/35 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.34em] text-muted">Add To Lists</p>
                  <p className="mt-1 text-sm text-white">
                    {listsContainingAlbum.size
                      ? `Saved in ${listsContainingAlbum.size} list${listsContainingAlbum.size === 1 ? '' : 's'}.`
                      : 'Save this album to one or more lists.'}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted tabular-nums">{lists.length} total</p>
              </div>

              <form onSubmit={handleCreateList} className="mt-4 flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="new-list-name">
                  New List Name
                </label>
                <input
                  id="new-list-name"
                  name="newListName"
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  placeholder="Late Night Rotation…"
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-xl border border-outline bg-panel px-3 py-2 text-sm text-white placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                />
                <button
                  type="submit"
                  className="inline-flex touch-manipulation items-center gap-2 rounded-xl border border-white/20 bg-white px-3 py-2 text-xs uppercase tracking-[0.25em] text-canvas transition-colors duration-200 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <FiPlus aria-hidden="true" />
                  New List
                </button>
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                {lists.length ? (
                  lists.map((list) => {
                    const isActive = listsContainingAlbum.has(list.id)
                    return (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => handleToggleList(list.id)}
                        className={`inline-flex touch-manipulation items-center gap-2 rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.24em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                          isActive
                            ? 'border-white/45 bg-white/15 text-white hover:bg-white/20'
                            : 'border-outline bg-panel text-muted hover:border-white/35 hover:text-white'
                        }`}
                      >
                        {isActive ? <FiCheck aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
                        <span className="max-w-44 truncate">{list.name}</span>
                        <span className="tabular-nums text-[0.62rem] text-muted">{list.albums.length}</span>
                      </button>
                    )
                  })
                ) : (
                  <p className="rounded-xl border border-dashed border-outline px-3 py-2 text-xs text-muted">
                    Create your first list to start collecting favorites.
                  </p>
                )}
              </div>

              <p aria-live="polite" className="mt-3 text-xs text-muted">
                {listStatus || 'Tap a list chip to add or remove this album.'}
              </p>
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

        </div>
      </div>
    </PageTransition>
  )
}

export default AlbumDetails
