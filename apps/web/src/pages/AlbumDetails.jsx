import { useEffect, useMemo, useState } from 'react'
import { FiCheck, FiPlus } from 'react-icons/fi'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import PageTransition from '../components/ui/PageTransition.jsx'
import RatingStars from '../components/ui/RatingStars.jsx'
import ReviewInput from '../components/review/ReviewInput.jsx'
import ReviewsList from '../components/review/ReviewsList.jsx'
import StreamingLinks from '../components/album/StreamingLinks.jsx'
import BackButton from '../components/ui/BackButton.jsx'
import Billboard, { PAGE_GUTTER } from '../components/ui/Billboard.jsx'
import VinylSleeve from '../components/ui/VinylSleeve.jsx'
import { AlbumDetailsPageSkeleton } from '../components/ui/PageLoadingState.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useLists } from '../hooks/useLists.js'
import { useRatings } from '../hooks/useRatings.js'
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
    loadingLists,
    listLoadError,
    refreshLists,
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
  const [reviewKey, setReviewKey] = useState(0)

  // The card that linked here already has name, cover and stats; show those now and let the tracklist load in.
  const seed = String(location.state?.album?.id) === albumId ? location.state.album : undefined
  const {
    data,
    isLoading: loading,
    isPlaceholderData: loadingTracks,
    error: queryError,
  } = useQuery({
    queryKey: ['release', albumId],
    queryFn: () => getReleaseDetails(albumId),
    enabled: !!albumId,
    placeholderData: seed,
  })
  // Keep the card's cover so the art the browser already has isn't swapped and downloaded again.
  const album = useMemo(() => (data && seed?.cover ? { ...data, cover: seed.cover } : data), [data, seed])

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
    if (albumId) {
      const timer = setTimeout(() => {
        setListStatus('')
        setNewListName('')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [albumId])

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
        <AlbumDetailsPageSkeleton />
      </PageTransition>
    )
  }

  if (queryError) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-lg py-16 text-center">
          <p className="font-display text-4xl text-paper">This record won&rsquo;t play.</p>
          <p className="mt-3 text-sm text-muted">{queryError.message ?? 'Unable to load album details.'}</p>
          <button
            type="button"
            onClick={goBack}
            className="mt-6 rounded-full border border-white/15 px-5 py-2 text-sm text-paper transition-colors hover:bg-white/[0.06]"
          >
            Go back
          </button>
        </div>
      </PageTransition>
    )
  }

  if (!album) return null

  const chipClass = (active) => `inline-flex touch-manipulation items-center gap-2 rounded-full border px-4 py-2 text-[13px] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
    active
      ? 'border-paper bg-paper text-black shadow-[0_8px_24px_rgba(238,234,227,0.18)]'
      : 'border-white/15 bg-white/[0.04] text-paper/85 hover:border-white/35 hover:bg-white/[0.08]'
  }`
  const listsDisabled = !isSignedIn || loadingLists || listLoadError
  const genreLine = albumGenres?.length ? albumGenres.slice(0, 3).join(', ') : 'Unknown genre'

  return (
    <PageTransition bleed>
      <Billboard artist={album.artists?.[0]} cover={album.cover} className="min-h-[86svh]">
        <>
          <BackButton onClick={goBack} />

          <div className="flex flex-col gap-8 md:flex-row md:items-end md:gap-10">
            <div className="w-44 shrink-0 pr-14 tablet:w-64 tablet:pr-20">
              <VinylSleeve src={album.cover} label={album.discLabel} alt={album.name} out spin loading="eager" />
            </div>

            <header className="min-w-0">
              <p className="text-sm font-medium text-paper/70">
                {formatReleaseDate(album.releaseDate, album.releaseYear)}, {genreLine}
              </p>
              <h1 className="mt-3 text-balance break-words font-display text-5xl leading-[0.92] text-paper tablet:text-7xl">{album.name}</h1>
              <p className="mt-3 text-xl font-medium text-paper/85 tablet:text-2xl">{album.artists?.join(', ')}</p>

              <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-5">
                <div>
                  <p className="text-sm text-paper/60">Community score</p>
                  {community.total > 0 ? (
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="font-display text-5xl leading-none text-paper">{community.average?.toFixed(1)}</span>
                      <span className="text-sm text-paper/60">
                        {formatLargeNumber(community.total)} {community.total === 1 ? 'vote' : 'votes'}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xl font-medium text-paper/85">No ratings yet</p>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-sm text-paper/60">{isSignedIn ? 'Your rating' : 'Sign in required to rate'}</p>
                  <RatingStars
                    value={userRating ?? 0}
                    readOnly={!isSignedIn}
                    align="left"
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
                  />
                </div>
              </div>
            </header>
          </div>

          <div className="mt-10">
            <StreamingLinks links={streamingLinks} />
          </div>
        </>
      </Billboard>

      <div className={`${PAGE_GUTTER} mt-10`}>
        <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="tracklist-heading">
            <h2 id="tracklist-heading" className="font-display text-3xl text-paper">Tracklist</h2>
            <ol className="mt-5 border-t border-white/[0.07]">
              {loadingTracks ? (
                Array.from({ length: 6 }, (_, index) => (
                  <li key={index} aria-hidden="true" className="border-b border-white/[0.07] px-1 py-3.5">
                    <span className="block h-4 w-2/3 rounded bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] motion-safe:animate-shimmer" />
                  </li>
                ))
              ) : album.tracks?.length ? (
                album.tracks.map((track, index) => (
                  <li
                    key={track.id ?? track.track_number}
                    className="group grid grid-cols-[2rem_minmax(0,1fr)_4rem] items-center gap-3 border-b border-white/[0.07] px-1 py-3.5 text-[15px] transition-colors hover:bg-white/[0.03]"
                  >
                    <span data-testid="track-number" className="text-sm text-muted">{index + 1}</span>
                    <span className="truncate text-paper">{track.name}</span>
                    <span data-testid="track-duration" className="text-right text-sm text-muted">{formatDuration(track.duration_ms)}</span>
                  </li>
                ))
              ) : (
                <li className="px-1 py-6 text-sm text-muted">Track details are not available for this release.</li>
              )}
            </ol>
          </section>

          <aside aria-labelledby="lists-heading" className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 backdrop-blur-sm">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="lists-heading" className="font-display text-2xl text-paper">Save to a list</h2>
                <p className="text-xs text-muted">
                  {loadingLists && isSignedIn ? 'Loading your lists' : listLoadError && isSignedIn ? 'Unavailable' : `${listsContainingAlbum.size} of ${lists.length}`}
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleListenLater}
                disabled={listsDisabled || listenLaterPending}
                aria-label="Toggle Listen Later"
                className={`mt-4 w-full justify-between ${chipClass(inListenLater)}`}
              >
                <span className="inline-flex items-center gap-2">
                  {inListenLater ? <FiCheck aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
                  Listen Later
                </span>
                <span className={`${inListenLater ? 'text-black/60' : 'text-muted'} text-xs`}>
                  {listenLaterList?.albums?.length ?? 0}
                </span>
              </button>

              <div className="mt-4 flex flex-wrap gap-2">
                {loadingLists && isSignedIn ? (
                  <div aria-hidden="true" className="flex gap-2">
                    <span className="h-9 w-28 rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] motion-safe:animate-shimmer" />
                    <span className="h-9 w-24 rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] motion-safe:animate-shimmer" />
                  </div>
                ) : listLoadError && isSignedIn ? (
                  <button type="button" onClick={() => void refreshLists().catch(() => {})} className={chipClass(false)}>
                    Retry loading lists
                  </button>
                ) : lists.length ? (
                  lists.map((list, index) => {
                    const isActive = listsContainingAlbum.has(list.id)
                    const isBusy = busyListIds.has(list.id)
                    const tilt = ['rotate-[-1.5deg]', 'rotate-[1.2deg]', 'rotate-[-0.6deg]', 'rotate-[1.6deg]'][index % 4]

                    return (
                      <button
                        key={list.id}
                        type="button"
                        disabled={!isSignedIn || isBusy}
                        onClick={() => handleToggleList(list.id)}
                        className={`${chipClass(isActive)} ${tilt} hover:rotate-0`}
                      >
                        {isActive ? <FiCheck aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
                        <span className="max-w-32 truncate">{list.name}</span>
                        <span className={`${isActive ? 'text-black/60' : 'text-muted'} text-xs`}>
                          {isBusy ? '…' : list.albums.length}
                        </span>
                      </button>
                    )
                  })
                ) : isSignedIn ? (
                  <p className="text-sm text-muted">No lists yet. Name your first one below.</p>
                ) : null}
              </div>

              <form onSubmit={handleCreateList} className="mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 p-1 pl-4 focus-within:border-white/30">
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
                  disabled={listsDisabled}
                  className="min-w-0 flex-1 bg-transparent text-sm text-paper placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleCreateList}
                  disabled={listsDisabled}
                  aria-label="Create list"
                  className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-full bg-paper text-black transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FiPlus aria-hidden="true" />
                </button>
              </form>

              {!isSignedIn && (
                <p className="mt-4 text-sm text-muted">
                  <button type="button" onClick={() => navigate('/auth')} className="text-paper underline underline-offset-4">
                    Sign in
                  </button>{' '}
                  to create lists and save albums.
                </p>
              )}

              <p aria-live="polite" className="mt-4 min-h-[1rem] text-xs text-muted">
                {listStatus || (isSignedIn ? 'Tap a list to add or remove this album.' : '')}
              </p>
            </div>
          </aside>
        </div>

        <section className="mt-20 max-w-3xl space-y-6" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="font-display text-3xl text-paper">Reviews</h2>

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
            <p className="rounded-2xl border border-dashed border-white/10 px-5 py-6 text-sm text-muted">
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="text-paper underline underline-offset-4"
              >
                Sign in
              </button>{' '}
              to read and write reviews.
            </p>
          )}

          {isSignedIn && <ReviewsList key={reviewKey} albumId={album.id} />}
        </section>
      </div>
    </PageTransition>
  )
}

export default AlbumDetails
