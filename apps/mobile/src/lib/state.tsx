import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// Shared with the web app so list rules (name length, caps) never drift between the two.
import { listStorageConfig, normalizeListName, toListAlbumSummary } from '../../../web/src/services/listsService.js'
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

  useEffect(() => {
    setRatings(bootstrap.data?.ratings ?? {})
    setLists(byUpdated((bootstrap.data?.lists ?? []).map(normalizeList).filter(Boolean)))
  }, [bootstrap.data])

  // Optimistic, like the web: the stars move at once and snap back if the save fails.
  const rateAlbum = useCallback((album: Album, value: number) => {
    if (!user?.id) return
    const id = String(album.id)
    const rating = Math.min(5, Math.max(0.5, Math.round(value * 2) / 2))
    const before = ratings[id]
    const clearing = Math.abs((before?.rating ?? 0) - rating) < 0.001
    setRatings((prev) => {
      const next = { ...prev }
      if (clearing) delete next[id]
      else next[id] = { rating, timestamp: Date.now() }
      return next
    })
    const request = clearing ? deleteRating(id) : saveRating(id, rating, { albumName: album.name, albumCover: album.cover })
    request
      .then((saved) => {
        const community = Number(saved?.communityRating)
        const count = Number(saved?.reviewCount)
        if (Number.isFinite(community) && Number.isFinite(count)) {
          queryClient.setQueryData(['release', id], (current: Album | undefined) =>
            current ? { ...current, communityRating: community, reviewCount: count } : current,
          )
        }
      })
      .catch(() =>
        setRatings((prev) => {
          const next = { ...prev }
          if (before) next[id] = before
          else delete next[id]
          return next
        }),
      )
  }, [user?.id, ratings, queryClient])

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
      return { ok: true, added: Boolean(result.added), listName: list.name }
    } catch {
      return { ok: false }
    }
  }, [lists, user?.id])

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
      return { ok: true, list: created }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }, [lists, user?.id])

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
