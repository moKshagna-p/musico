import { useEffect, useMemo, useState } from 'react'
import { FiArrowLeft, FiCheck, FiClock, FiPlus } from 'react-icons/fi'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import PageTransition from '../components/PageTransition.jsx'
import RatingStars from '../components/RatingStars.jsx'
import ReviewInput from '../components/ReviewInput.jsx'
import ReviewsList from '../components/ReviewsList.jsx'
import StreamingLinks from '../components/StreamingLinks.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useLists } from '../hooks/useLists.js'
import { useRatings } from '../hooks/useRatings.js'
import { trackOpenedAlbumGenres } from '../services/recommendationProfileService.js'
import { getReleaseDetails } from '../services/discogsService.js'
import { saveMyReview } from '../services/socialService.js'
import {
  formatDuration,
  formatLargeNumber,
  formatReleaseDate,
  generateStreamingLinks,
  inferAlbumGenres,
} from '../utils/helpers.js'

const AlbumDetails = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { albumId } = useParams()
  const { user } = useAuth()
  const {
    lists,
    listenLaterList,
    createList,
    toggleAlbumInList,
    toggleAlbumInListenLater,
    getListsContainingAlbum,
    isAlbumInListenLater,
  } = useLists()
  const { rateAlbum, getUserRating, getCommunityStats } = useRatings()
  const isSignedIn = Boolean(user?.id)

  const [newListName, setNewListName] = useState('')
  const [listStatus, setListStatus] = useState('')
  const [listenLaterPending, setListenLaterPending] = useState(false)
  const [busyListIds, setBusyListIds] = useState(() => new Set())
  const [reviewKey, setReviewKey] = useState(0) // increment to refresh reviews list

  // Professional Data Fetching with TanStack Query
  const { 
    data: album, 
    isLoading: loading, 
    error: queryError 
  } = useQuery({
    queryKey: ['release', albumId],
    queryFn: () => getReleaseDetails(albumId),
    enabled: !!albumId,
  })

  const streamingLinks = useMemo(() => generateStreamingLinks(album), [album])
  const albumGenres = useMemo(() => inferAlbumGenres(album), [album])
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
  const inListenLater = useMemo(() => isAlbumInListenLater(album?.id ?? ''), [album?.id, isAlbumInListenLater])

  useEffect(() => {
    // Reset local component state when navigating to a new album
    if (albumId) {
      // Wrap in setTimeout to avoid synchronous setState inside effect warning
      const timer = setTimeout(() => {
        setListStatus('')
        setNewListName('')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [albumId])

  useEffect(() => {
    if (!album || !isSignedIn) return
    if (location.state?.from !== '/search') return

    trackOpenedAlbumGenres({
      album,
      scope: user.id,
    })
  }, [album, isSignedIn, location.state, user?.id])

  const handleCreateList = async (event) => {
    event.preventDefault()
    if (!isSignedIn) {
      setListStatus('Sign in to create and manage lists.')
      return
    }
    const result = await createList(newListName, { initialAlbum: albumSummary })

    if (!result.ok) {
      if (result.reason === 'duplicate') {
        setListStatus('A list with this name already exists.')
      } else if (result.reason === 'limit') {
        setListStatus('You reached the list limit. Remove one list to create another.')
      } else if (result.reason === 'auth') {
        setListStatus('Sign in to create lists.')
      } else {
        setListStatus('Enter a list name to continue.')
      }
      return
    }

    setNewListName('')
    if (result.added) {
      setListStatus(`Created ${result.list.name} and added this album.`)
    } else {
      const toggleResult = await toggleAlbumInList(result.list.id, albumSummary)
      if (toggleResult.ok && toggleResult.added) {
        setListStatus(`Created ${result.list.name} and added this album.`)
      } else {
        setListStatus(`Created ${result.list.name}.`)
      }
    }
  }

  const handleToggleList = async (listId) => {
    if (!isSignedIn) {
      setListStatus('Sign in to update lists.')
      return
    }
    setBusyListIds((prev) => {
      const next = new Set(prev)
      next.add(listId)
      return next
    })

    try {
      const result = await toggleAlbumInList(listId, albumSummary)
      if (!result.ok) {
        if (result.reason === 'auth') {
          setListStatus('Sign in to update lists.')
        } else if (result.reason === 'limit') {
          setListStatus('This list already has the maximum number of albums.')
        } else {
          setListStatus('Unable to update list right now.')
        }
        return
      }

      setListStatus(result.added ? `Added to ${result.listName}.` : `Removed from ${result.listName}.`)
    } finally {
      setBusyListIds((prev) => {
        const next = new Set(prev)
        next.delete(listId)
        return next
      })
    }
  }

  const handleToggleListenLater = async () => {
    if (listenLaterPending) return
    if (!isSignedIn) {
      setListStatus('Sign in to save albums to Listen Later.')
      return
    }

    setListenLaterPending(true)
    try {
      const result = await toggleAlbumInListenLater(albumSummary)
      if (!result.ok) {
        if (result.reason === 'auth') {
          setListStatus('Sign in to update Listen Later.')
        } else if (result.reason === 'limit') {
          setListStatus('Listen Later is full. Remove one album to continue.')
        } else {
          setListStatus('Unable to update Listen Later right now.')
        }
        return
      }

      if (result.added) {
        setListStatus(result.createdList ? 'Created Listen Later and added this album.' : 'Added to Listen Later.')
      } else {
        setListStatus('Removed from Listen Later.')
      }
    } finally {
      setListenLaterPending(false)
    }
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
        <div className="grid gap-8 tablet:grid-cols-[360px,1fr]">
          <div className="h-[420px] rounded-2xl border border-outline bg-panel/60" />
          <div className="space-y-4">
            <div className="h-3 w-24 rounded-full bg-white/10" />
            <div className="h-12 w-2/3 rounded-xl bg-white/10" />
            <div className="h-6 w-1/2 rounded-full bg-white/10" />
            <div className="space-y-2">
              <div className="h-4 rounded-full bg-white/5" />
              <div className="h-4 rounded-full bg-white/5" />
            </div>
            <div className="h-48 rounded-2xl border border-outline bg-panel/60" />
          </div>
        </div>
      </PageTransition>
    )
  }

  if (queryError) {
    return (
      <PageTransition>
        <div className="rounded-3xl border border-white/5 bg-red-500/10 px-6 py-8 text-center text-red-200">
          <p className="font-semibold">{queryError.message ?? 'Unable to load album details.'}</p>
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
        className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas tablet:tracking-[0.42em]"
      >
        <FiArrowLeft aria-hidden="true" /> Back
      </button>

      <div className="grid gap-10 tablet:grid-cols-[360px,1fr]">
        <aside className="space-y-6 tablet:sticky tablet:top-28 tablet:self-start">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-panel p-2 shadow-panel">
            <img
              src={album.cover}
              alt={album.name}
              width="640"
              height="640"
              className="aspect-square w-full rounded-xl bg-black/40 object-contain p-1"
            />
          </div>
          <StreamingLinks links={streamingLinks} />
        </aside>

        <section className="space-y-10">
          <header className="space-y-2 border-b border-outline pb-7">
            <p className="text-xs uppercase tracking-[0.52em] text-muted">Album</p>
            <h1 className="font-display text-3xl leading-tight tablet:text-5xl">{album.name}</h1>
            <p className="text-lg text-white/80">{album.artists.join(', ')}</p>
            <p className="pt-1 text-xs uppercase tracking-[0.28em] text-muted">
              {formatReleaseDate(album.releaseDate, album.releaseYear)}
            </p>
            <p className="text-xs uppercase tracking-[0.28em] text-muted">
              {albumGenres?.length ? albumGenres.slice(0, 3).join(' • ') : 'Unknown Genre'}
            </p>
          </header>

          <div className="grid gap-10 tablet:grid-cols-[0.62fr,1fr]">
            <section className="space-y-3 border-b border-outline pb-8 tablet:border-b-0 tablet:border-r tablet:pb-0 tablet:pr-8">
              <p className="text-[0.62rem] uppercase tracking-[0.38em] text-muted">Score</p>
              <p className="text-5xl font-semibold leading-none tabular-nums text-white tablet:text-6xl">{community.average?.toFixed(1)}</p>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">{formatLargeNumber(community.total)} votes</p>
              <div className="pt-5">
                <RatingStars
                  value={userRating ?? 0}
                  readOnly={!isSignedIn}
                  onRate={(value) => {
                    if (!isSignedIn) {
                      setListStatus('Sign in to rate albums.')
                      return
                    }
                    rateAlbum(album.id, value, {
                      albumName: album.name,
                      albumCover: album.cover,
                    })
                  }}
                  showValue
                />
                {!isSignedIn && (
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">Sign in required to rate</p>
                )}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_130%_at_95%_0%,rgba(198,170,126,0.12),rgba(198,170,126,0.02)_36%,rgba(0,0,0,0)_70%),linear-gradient(160deg,rgba(2,2,2,0.98),rgba(8,8,8,0.96))] p-5 tablet:p-6">
              <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#c6aa7e]/10 blur-3xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-black/50 blur-3xl" />

              <div className="relative z-10 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] uppercase tracking-[0.35em] text-white/65">Lists</p>
                  <p className="text-sm text-white/85">{listsContainingAlbum.size} selected</p>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">{lists.length} total</p>
              </div>

              <div className="relative z-10 mt-3">
                <button
                  type="button"
                  onClick={handleToggleListenLater}
                  disabled={!isSignedIn || listenLaterPending}
                  aria-label="Toggle Listen Later"
                  className={`inline-flex touch-manipulation items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-55 ${
                    inListenLater
                      ? 'border-white/70 bg-white text-canvas shadow-[0_8px_24px_rgba(255,255,255,0.25)]'
                      : 'border-white/25 bg-white/[0.06] text-white/85 hover:border-white/55 hover:bg-white/[0.14]'
                  }`}
                >
                  {inListenLater ? <FiCheck aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
                  <span>Listen Later</span>
                  <span className={`${inListenLater ? 'text-canvas/70' : 'text-white/55'} tabular-nums text-[0.62rem]`}>
                    {listenLaterList?.albums?.length ?? 0}
                  </span>
                </button>
              </div>

              <form onSubmit={handleCreateList} className="relative z-10 mt-4 flex items-center gap-2 border-b border-white/20 pb-2">
                <label className="sr-only" htmlFor="new-list-name">
                  New List Name
                </label>
                <input
                  id="new-list-name"
                  name="newListName"
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  placeholder="New list"
                  autoComplete="off"
                  disabled={!isSignedIn}
                  className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleCreateList}
                  disabled={!isSignedIn}
                  aria-label="Create list"
                  className="inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded-full border border-white/35 bg-white/90 text-canvas transition-colors duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <FiPlus aria-hidden="true" />
                </button>
              </form>

              {!isSignedIn && (
                <div className="relative z-10 mt-4 rounded-xl border border-outline/80 bg-canvas/30 px-3 py-2 text-xs text-muted">
                  Sign in to create lists and save albums.
                  <button
                    type="button"
                    onClick={() => navigate('/auth')}
                    className="ml-2 uppercase tracking-[0.2em] text-white transition hover:text-muted"
                  >
                    Sign In
                  </button>
                </div>
              )}

              <div className="relative z-10 mt-5 flex flex-wrap gap-2.5">
                {lists.length ? (
                  lists.map((list, index) => {
                    const isActive = listsContainingAlbum.has(list.id)
                    const isBusy = busyListIds.has(list.id)
                    const variants = [
                      'rotate-[-1.8deg]',
                      'rotate-[1.4deg]',
                      'rotate-[-0.8deg]',
                      'rotate-[1.9deg]',
                    ]
                    const tilt = variants[index % variants.length]

                    return (
                      <button
                        key={list.id}
                        type="button"
                        disabled={!isSignedIn || isBusy}
                        onClick={() => handleToggleList(list.id)}
                        className={`inline-flex touch-manipulation items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-55 ${
                          isActive
                            ? `border-white/70 bg-white text-canvas shadow-[0_8px_24px_rgba(255,255,255,0.25)] ${tilt}`
                            : `border-white/25 bg-white/[0.06] text-white/80 hover:border-white/55 hover:bg-white/[0.14] ${tilt}`
                        }`}
                      >
                        {isActive ? <FiCheck aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
                        <span className="max-w-28 truncate tablet:max-w-36">{list.name}</span>
                        <span className={`${isActive ? 'text-canvas/70' : 'text-white/55'} min-w-[2.2rem] text-right tabular-nums text-[0.62rem]`}>
                          {isBusy ? '...' : list.albums.length}
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <p className="text-sm text-white/65">No lists yet. Create your first one above.</p>
                )}
              </div>

              <p aria-live="polite" className="relative z-10 mt-4 text-xs text-white/60">
                {listStatus || 'Tap chips to add or remove instantly.'}
              </p>
            </section>
          </div>

          <section>
            <p className="text-xs uppercase tracking-[0.42em] text-muted">Tracklist</p>
            <div className="mt-4 border-y border-outline/90">
              {album.tracks?.length ? (
                album.tracks.map((track, index) => (
                  <div
                    key={track.id ?? track.track_number}
                    className="flex items-center justify-between border-b border-outline/80 px-2 py-3 text-sm last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="w-4 text-xs tabular-nums text-muted">{track.track_number ?? index + 1}</span>
                      <span className="truncate text-white">{track.name}</span>
                    </div>
                    <span className="ml-3 flex shrink-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
                      <FiClock aria-hidden="true" />
                      {formatDuration(track.duration_ms)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="px-4 py-6 text-sm text-muted">Track details are not available for this release.</p>
              )}
            </div>
          </section>

          {/* Reviews */}
          <section className="space-y-6">
            <p className="text-xs uppercase tracking-[0.42em] text-muted">Reviews</p>

            {isSignedIn ? (
              <ReviewInput
                albumId={album.id}
                onSave={async (content) => {
                  await saveMyReview(album.id, {
                    content,
                    albumName: album.name,
                    albumCover: album.cover,
                    albumArtists: album.artists,
                  })
                  setReviewKey((k) => k + 1)
                }}
              />
            ) : (
              <div className="rounded-xl border border-outline bg-panel/30 px-4 py-4 text-sm text-muted">
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="text-white hover:underline"
                >
                  Sign in
                </button>{' '}
                to write a review.
              </div>
            )}

            <ReviewsList key={reviewKey} albumId={album.id} />
          </section>
        </section>
      </div>
    </PageTransition>
  )
}

export default AlbumDetails
