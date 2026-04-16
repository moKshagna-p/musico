/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

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
export const ListsContext = createContext(null)
const LISTEN_LATER_LIST_NAME = 'Listen Later'

const findListByName = (items, name) => {
  const normalizedTarget = normalizeListName(name).toLowerCase()
  if (!normalizedTarget) return null
  return items.find((list) => normalizeListName(list?.name).toLowerCase() === normalizedTarget) ?? null
}

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

const applyAlbumToggleToList = (list, albumSummary, added, timestamp) => {
  const exists = list.albums.some((entry) => entry.id === albumSummary.id)
  const albums = added
    ? exists
      ? list.albums
      : [{ ...albumSummary, addedAt: timestamp }, ...list.albums].slice(0, listStorageConfig.MAX_ALBUMS_PER_LIST)
    : list.albums.filter((entry) => entry.id !== albumSummary.id)

  return {
    ...list,
    albums,
    updatedAt: timestamp,
  }
}

export const ListsProvider = ({ children }) => {
  const { user, isPending } = useAuth()
  const [lists, setLists] = useState([])

  const loadRemoteLists = useCallback(async () => {
    const remote = await fetchMyLists()
    const normalized = remote.map(normalizeRemoteList).filter(Boolean)
    const sorted = sortListsByUpdatedAt(normalized)
    setLists(sorted)
    return sorted
  }, [])

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

  const ensureListenLaterList = useCallback(async () => {
    if (!user?.id) return { ok: false, reason: 'auth' }

    const existing = findListByName(lists, LISTEN_LATER_LIST_NAME)
    if (existing) return { ok: true, list: existing, created: false }

    const created = await createList(LISTEN_LATER_LIST_NAME)
    if (created.ok && created.list) {
      return { ok: true, list: created.list, created: true }
    }

    if (created.reason === 'duplicate') {
      try {
        const remoteLists = await loadRemoteLists()
        const recovered = findListByName(remoteLists, LISTEN_LATER_LIST_NAME)
        if (recovered) {
          return { ok: true, list: recovered, created: false }
        }
      } catch {
        // Ignore reload failures and return a safe error.
      }
      return { ok: false, reason: 'list' }
    }

    return { ok: false, reason: created.reason ?? 'server' }
  }, [createList, lists, loadRemoteLists, user?.id])

  const toggleAlbumInList = useCallback(
    async (listId, album, options = {}) => {
      if (!user?.id) return { ok: false, reason: 'auth' }

      const normalizedListId = String(listId ?? '').trim()
      const albumSummary = toListAlbumSummary(album)
      if (!normalizedListId || !albumSummary) return { ok: false, reason: 'invalid' }

      const target = lists.find((list) => list.id === normalizedListId)
      const fallbackListName = normalizeListName(options?.listName)
      const targetListName = target?.name ?? fallbackListName ?? 'List'
      const existsBefore = Boolean(target?.albums.some((entry) => entry.id === albumSummary.id))
      const optimisticAdded = !existsBefore
      const optimisticTimestamp = Date.now()
      const canOptimisticallyUpdate = Boolean(target || fallbackListName)

      if (canOptimisticallyUpdate) {
        setLists((prev) =>
          sortListsByUpdatedAt((() => {
            let didUpdate = false
            const next = prev.map((list) => {
              if (list.id !== normalizedListId) return list
              didUpdate = true
              return applyAlbumToggleToList(list, albumSummary, optimisticAdded, optimisticTimestamp)
            })

            if (didUpdate) return next

            return [
              {
                id: normalizedListId,
                name: targetListName,
                albums: optimisticAdded ? [{ ...albumSummary, addedAt: optimisticTimestamp }] : [],
                createdAt: optimisticTimestamp,
                updatedAt: optimisticTimestamp,
              },
              ...next,
            ]
          })()),
        )
      }

      try {
        const response = await toggleAlbumInMyList(normalizedListId, albumSummary)
        const added = Boolean(response?.added)
        const resolvedTimestamp = Date.now()

        if (canOptimisticallyUpdate && added !== optimisticAdded) {
          setLists((prev) =>
            sortListsByUpdatedAt(
              prev.map((list) => {
                if (list.id !== normalizedListId) return list
                return applyAlbumToggleToList(list, albumSummary, added, resolvedTimestamp)
              }),
            ),
          )
        }

        return {
          ok: true,
          added,
          listName: response?.listName ?? targetListName,
        }
      } catch (error) {
        if (canOptimisticallyUpdate) {
          setLists((prev) => {
            const hadOptimisticPlaceholder = !target && prev.some((list) => list.id === normalizedListId)
            const reverted = prev
              .map((list) => {
                if (list.id !== normalizedListId) return list
                return applyAlbumToggleToList(list, albumSummary, existsBefore, Date.now())
              })
              .filter((list) => !(hadOptimisticPlaceholder && !target && list.id === normalizedListId && !existsBefore))

            return sortListsByUpdatedAt(reverted)
          })

          void loadRemoteLists().catch(() => {
            // Ignore background sync failures.
          })
        }

        const message = String(error?.message ?? '').toLowerCase()
        if (message.includes('unauthorized')) return { ok: false, reason: 'auth' }
        if (message.includes('full')) return { ok: false, reason: 'limit' }
        return { ok: false, reason: 'server' }
      }
    },
    [lists, loadRemoteLists, user?.id],
  )

  const getListsContainingAlbum = useCallback(
    (albumId) => {
      const normalized = String(albumId ?? '').trim()
      if (!normalized) return []
      return lists.filter((list) => list.albums.some((album) => album.id === normalized)).map((list) => list.id)
    },
    [lists],
  )

  const toggleAlbumInListenLater = useCallback(
    async (album) => {
      if (!user?.id) return { ok: false, reason: 'auth' }

      const albumSummary = toListAlbumSummary(album)
      if (!albumSummary) return { ok: false, reason: 'invalid' }

      const targetList = await ensureListenLaterList()
      if (!targetList.ok) {
        return { ok: false, reason: targetList.reason ?? 'server' }
      }

      const toggled = await toggleAlbumInList(targetList.list.id, albumSummary, { listName: targetList.list.name })
      if (!toggled.ok) return toggled

      return {
        ...toggled,
        listId: targetList.list.id,
        listName: targetList.list.name ?? LISTEN_LATER_LIST_NAME,
        createdList: targetList.created,
      }
    },
    [ensureListenLaterList, toggleAlbumInList, user?.id],
  )

  const listenLaterList = useMemo(() => findListByName(lists, LISTEN_LATER_LIST_NAME), [lists])

  const isAlbumInListenLater = useCallback(
    (albumId) => {
      const normalized = String(albumId ?? '').trim()
      if (!normalized || !listenLaterList) return false
      return listenLaterList.albums.some((album) => album.id === normalized)
    },
    [listenLaterList],
  )

  const value = useMemo(
    () => ({
      lists,
      listenLaterList,
      createList,
      toggleAlbumInList,
      toggleAlbumInListenLater,
      getListsContainingAlbum,
      isAlbumInListenLater,
    }),
    [
      lists,
      listenLaterList,
      createList,
      toggleAlbumInList,
      toggleAlbumInListenLater,
      getListsContainingAlbum,
      isAlbumInListenLater,
    ],
  )

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>
}
