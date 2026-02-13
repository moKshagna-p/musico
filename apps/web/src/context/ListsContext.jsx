import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '../hooks/useAuth.js'
import {
  createMyList,
  fetchMyLists,
  toggleAlbumInMyList,
} from '../services/profileDataService.js'
import {
  listStorageConfig,
  normalizeListName,
  toListAlbumSummary,
} from '../services/listsService.js'
import { ListsContext } from './listsContext.js'

const normalizeRemoteList = (value) => {
  const id = String(value?.id ?? '').trim()
  const name = normalizeListName(value?.name)
  if (!id || !name) return null

  const albums = Array.isArray(value?.albums)
    ? value.albums
        .map((entry) => toListAlbumSummary(entry))
        .filter(Boolean)
    : []

  return {
    id,
    name,
    albums,
    createdAt: Number(value?.createdAt ?? Date.now()),
    updatedAt: Number(value?.updatedAt ?? Date.now()),
  }
}

const sortListsByUpdatedAt = (lists) => [...lists].sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0))

export const ListsProvider = ({ children }) => {
  const { user, isPending } = useAuth()
  const [lists, setLists] = useState([])

  useEffect(() => {
    let isCancelled = false

    const loadLists = async () => {
      if (isPending) return
      if (!user?.id) {
        setLists([])
        return
      }

      try {
        const remote = await fetchMyLists()
        if (isCancelled) return
        const normalized = remote.map(normalizeRemoteList).filter(Boolean)
        setLists(sortListsByUpdatedAt(normalized))
      } catch {
        if (!isCancelled) {
          setLists([])
        }
      }
    }

    void loadLists()

    return () => {
      isCancelled = true
    }
  }, [isPending, user?.id])

  const createList = useCallback(
    async (name) => {
      if (!user?.id) return { ok: false, reason: 'auth' }

      const normalized = normalizeListName(name)
      if (!normalized) return { ok: false, reason: 'empty' }

      const duplicate = lists.some((list) => list.name.toLowerCase() === normalized.toLowerCase())
      if (duplicate) return { ok: false, reason: 'duplicate' }
      if (lists.length >= listStorageConfig.MAX_LISTS) return { ok: false, reason: 'limit' }

      try {
        const created = normalizeRemoteList(await createMyList(normalized))
        if (!created) return { ok: false, reason: 'invalid' }

        setLists((prev) => sortListsByUpdatedAt([created, ...prev]))
        return { ok: true, list: created }
      } catch (error) {
        const message = String(error?.message ?? '').toLowerCase()
        if (message.includes('already exists')) return { ok: false, reason: 'duplicate' }
        if (message.includes('limit')) return { ok: false, reason: 'limit' }
        if (message.includes('unauthorized')) return { ok: false, reason: 'auth' }
        return { ok: false, reason: 'server' }
      }
    },
    [lists, user?.id],
  )

  const toggleAlbumInList = useCallback(
    async (listId, album) => {
      if (!user?.id) return { ok: false, reason: 'auth' }

      const normalizedListId = String(listId ?? '').trim()
      const albumSummary = toListAlbumSummary(album)
      if (!normalizedListId || !albumSummary) return { ok: false, reason: 'invalid' }

      const target = lists.find((list) => list.id === normalizedListId)
      if (!target) return { ok: false, reason: 'list' }

      try {
        const response = await toggleAlbumInMyList(normalizedListId, albumSummary)
        const added = Boolean(response?.added)
        const now = Date.now()

        setLists((prev) =>
          sortListsByUpdatedAt(
            prev.map((list) => {
              if (list.id !== normalizedListId) return list

              const exists = list.albums.some((entry) => entry.id === albumSummary.id)
              const albums = added
                ? exists
                  ? list.albums
                  : [{ ...albumSummary, addedAt: now }, ...list.albums].slice(0, listStorageConfig.MAX_ALBUMS_PER_LIST)
                : list.albums.filter((entry) => entry.id !== albumSummary.id)

              return {
                ...list,
                albums,
                updatedAt: now,
              }
            }),
          ),
        )

        return {
          ok: true,
          added,
          listName: response?.listName ?? target.name,
        }
      } catch (error) {
        const message = String(error?.message ?? '').toLowerCase()
        if (message.includes('unauthorized')) return { ok: false, reason: 'auth' }
        if (message.includes('full')) return { ok: false, reason: 'limit' }
        return { ok: false, reason: 'server' }
      }
    },
    [lists, user?.id],
  )

  const getListsContainingAlbum = useCallback(
    (albumId) => {
      const normalized = String(albumId ?? '').trim()
      if (!normalized) return []
      return lists.filter((list) => list.albums.some((album) => album.id === normalized)).map((list) => list.id)
    },
    [lists],
  )

  const value = useMemo(
    () => ({
      lists,
      createList,
      toggleAlbumInList,
      getListsContainingAlbum,
    }),
    [lists, createList, toggleAlbumInList, getListsContainingAlbum],
  )

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>
}
