import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// Shared with the web app so list rules (name length, caps) never drift between the two.
import { listStorageConfig, normalizeListName, toListAlbumSummary } from '../../../web/src/services/listsService.js'
import { createWriteQueue } from './writes'
import { authClient, createList as createRemoteList, deleteRating, fetchBootstrap, saveRating, toggleListAlbum, type Album } from './api'

export type ListAlbum = { id: string; name: string; cover: string; artists: string[]; releaseYear: number | null; addedAt: number }
export type MusicList = { id: string; name: string; albums: ListAlbum[]; updatedAt: number }
type Ratings = Record<string, { rating: number; timestamp: number }>

const LISTEN_LATER = 'Listen Later'

const normalizeList = (value: any): MusicList | null => {
  const id = String(value?.id ?? '').trim()
  const name = normalizeListName(value?.name)
  if (!id || !name) return null
  const albums = (Array.isArray(value?.albums) ? value.albums : []).map(toListAlbumSummary).filter(Boolean)
  return { id, name, albums, updatedAt: Number(value?.updatedAt ?? Date.now()) }
}

const byUpdated = (lists: MusicList[]) => [...lists].sort((a, b) => b.updatedAt - a.updatedAt)

export const useAuth = () => {
  const session = authClient.useSession()
  const queryClient = useQueryClient()
  const userId = session.data?.user?.id ?? null
  const previous = useRef(userId)
  // Someone else's cached data must never show after an account switch.
  useEffect(() => {
    if (previous.current && previous.current !== userId) queryClient.clear()
    previous.current = userId
  }, [queryClient, userId])
  return { ...session, user: session.data?.user ?? null }
}

type MeContext = {
  ratings: Ratings
  lists: MusicList[]
  loadingLists: boolean
  listenLater: MusicList | null
  rateAlbum: (album: Album, rating: number) => void
  toggleInList: (listId: string, album: Album) => Promise<{ ok: boolean; added?: boolean; listName?: string }>
  toggleListenLater: (album: Album) => Promise<{ ok: boolean; added?: boolean }>
  createList: (name: string, album?: Album) => Promise<{ ok: boolean; reason?: string; list?: MusicList }>
}

const Me = createContext<MeContext | null>(null)

export const MeProvider = ({ children }: { children: ReactNode }) => {
  const { user, isPending } = useAuth()
  const queryClient = useQueryClient()
  const bootstrap = useQuery({
    queryKey: ['me-bootstrap', user?.id ?? null],
    queryFn: fetchBootstrap,
    enabled: !isPending && Boolean(user?.id),
    staleTime: Infinity,
    retry: false,
  })
  const [ratings, setRatings] = useState<Ratings>({})
  const [lists, setLists] = useState<MusicList[]>([])

  // Ratings the server has confirmed: where a failed newest write snaps back to. One write queue per album, and
  // each write is tied to the account that made it (signedInAs is read when a queued write starts).
  const confirmed = useRef<Ratings>({})
  const [queueWrite] = useState(createWriteQueue)
  const signedInAs = useRef(user?.id ?? null)
  signedInAs.current = user?.id ?? null

  // Pages built from these (profile totals, history, lists, profiles) refetch the next time they're shown.
  const refreshSavedViews = useCallback((listId?: string) => {
    for (const queryKey of [['dashboard'], ['profile-history'], ['user-profile'], ...(listId ? [['public-list', listId]] : [])]) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }, [queryClient])

  useEffect(() => {
    confirmed.current = bootstrap.data?.ratings ?? {}
    setRatings(bootstrap.data?.ratings ?? {})
    setLists(byUpdated((bootstrap.data?.lists ?? []).map(normalizeList).filter(Boolean)))
  }, [bootstrap.data])

  // Optimistic, like the web: the stars move at once. Writes for an album go out in tap order, and only the newest
  // one's outcome counts, so quick taps can't end on an older rating and a late failure can't undo a newer choice.
  const rateAlbum = useCallback((album: Album, value: number) => {
    if (!user?.id) return
    const id = String(album.id)
    const rating = Math.min(5, Math.max(0.5, Math.round(value * 2) / 2))
    const clearing = Math.abs((ratings[id]?.rating ?? 0) - rating) < 0.001
    const setOne = (entry: { rating: number; timestamp: number } | undefined) =>
      setRatings((prev) => {
        const next = { ...prev }
        if (entry) next[id] = entry
        else delete next[id]
        return next
      })
    setOne(clearing ? undefined : { rating, timestamp: Date.now() })

    const author = user.id
    void queueWrite(
      `${author}:${id}`,
      () => (clearing ? deleteRating(id) : saveRating(id, rating, { albumName: album.name, albumCover: album.cover })),
      () => signedInAs.current === author,
    ).then((result) => {
      // Signed out or switched accounts since: this account's state is gone, so there's nothing to apply.
      if (signedInAs.current !== author) return
      if (!result.ok) {
        if (result.current) setOne(confirmed.current[id])
        return
      }
      const saved = result.value
      const savedRating = Number(saved?.rating)
      const entry = Number.isFinite(savedRating) && savedRating > 0 ? { rating: savedRating, timestamp: Number(saved?.timestamp ?? Date.now()) } : undefined
      if (entry) confirmed.current = { ...confirmed.current, [id]: entry }
      else {
        const { [id]: _removed, ...rest } = confirmed.current
        confirmed.current = rest
      }
      if (!result.current) return
      const community = Number(saved?.communityRating)
      const count = Number(saved?.reviewCount)
      if (Number.isFinite(community) && Number.isFinite(count)) {
        queryClient.setQueryData(['release', id], (current: Album | undefined) =>
          current ? { ...current, communityRating: community, reviewCount: count } : current,
        )
      }
      refreshSavedViews()
    })
  }, [user?.id, ratings, queryClient, queueWrite, refreshSavedViews])

  const applyToggle = (listId: string, summary: ListAlbum, added: boolean) =>
    setLists((prev) =>
      byUpdated(
        prev.map((list) => {
          if (list.id !== listId) return list
          const albums = added
            ? [summary, ...list.albums.filter((entry) => entry.id !== summary.id)].slice(0, listStorageConfig.MAX_ALBUMS_PER_LIST)
            : list.albums.filter((entry) => entry.id !== summary.id)
          return { ...list, albums, updatedAt: Date.now() }
        }),
      ),
    )

  const toggleInList = useCallback(async (listId: string, album: Album) => {
    const summary = toListAlbumSummary(album)
    const list = lists.find((entry) => entry.id === listId)
    if (!user?.id || !summary || !list) return { ok: false }
    try {
      const result = await toggleListAlbum(listId, summary)
      applyToggle(listId, summary, Boolean(result.added))
      refreshSavedViews(listId)
      return { ok: true, added: Boolean(result.added), listName: list.name }
    } catch {
      return { ok: false }
    }
  }, [lists, user?.id, refreshSavedViews])

  const createList = useCallback(async (name: string, album?: Album) => {
    if (!user?.id) return { ok: false, reason: 'auth' }
    const normalized = normalizeListName(name)
    if (!normalized) return { ok: false, reason: 'empty' }
    if (lists.some((list) => list.name.toLowerCase() === normalized.toLowerCase())) return { ok: false, reason: 'duplicate' }
    if (lists.length >= listStorageConfig.MAX_LISTS) return { ok: false, reason: 'limit' }
    try {
      const created = normalizeList(await createRemoteList(normalized, (album && toListAlbumSummary(album)) || undefined))
      if (!created) return { ok: false, reason: 'error' }
      setLists((prev) => byUpdated([created, ...prev]))
      refreshSavedViews()
      return { ok: true, list: created }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }, [lists, user?.id, refreshSavedViews])

  const listenLater = lists.find((list) => list.name.toLowerCase() === LISTEN_LATER.toLowerCase()) ?? null

  const toggleListenLater = useCallback(async (album: Album) => {
    if (listenLater) return toggleInList(listenLater.id, album)
    const created = await createList(LISTEN_LATER, album)
    return { ok: created.ok, added: created.ok }
  }, [listenLater, toggleInList, createList])

  const value = useMemo(
    () => ({ ratings, lists, loadingLists: bootstrap.isLoading, listenLater, rateAlbum, toggleInList, toggleListenLater, createList }),
    [ratings, lists, bootstrap.isLoading, listenLater, rateAlbum, toggleInList, toggleListenLater, createList],
  )
  return <Me.Provider value={value}>{children}</Me.Provider>
}

export const useMe = () => {
  const context = useContext(Me)
  if (!context) throw new Error('useMe must be used inside MeProvider')
  return context
}
