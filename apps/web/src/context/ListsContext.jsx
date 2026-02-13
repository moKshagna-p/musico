import { useCallback, useMemo, useState } from 'react'

import {
  buildNewList,
  listStorageConfig,
  loadListsFromStorage,
  normalizeListName,
  persistListsToStorage,
  toListAlbumSummary,
} from '../services/listsService.js'
import { ListsContext } from './listsContext.js'

export const ListsProvider = ({ children }) => {
  const [lists, setLists] = useState(() => loadListsFromStorage())

  const createList = useCallback((name) => {
    const normalized = normalizeListName(name)
    if (!normalized) return { ok: false, reason: 'empty' }

    let outcome = { ok: false, reason: 'unknown' }
    setLists((prev) => {
      const duplicate = prev.some((list) => list.name.toLowerCase() === normalized.toLowerCase())
      if (duplicate) {
        outcome = { ok: false, reason: 'duplicate' }
        return prev
      }

      if (prev.length >= listStorageConfig.MAX_LISTS) {
        outcome = { ok: false, reason: 'limit' }
        return prev
      }

      const created = buildNewList(normalized)
      if (!created) {
        outcome = { ok: false, reason: 'empty' }
        return prev
      }

      const next = [created, ...prev]
      persistListsToStorage(next)
      outcome = { ok: true, list: created }
      return next
    })

    return outcome
  }, [])

  const toggleAlbumInList = useCallback((listId, album) => {
    const albumSummary = toListAlbumSummary(album)
    if (!albumSummary) return { ok: false, reason: 'album' }

    let outcome = { ok: false, reason: 'list' }
    setLists((prev) => {
      let updated = false
      const next = prev.map((list) => {
        if (list.id !== listId) return list

        const existingIndex = list.albums.findIndex((entry) => entry.id === albumSummary.id)
        const isAlreadyAdded = existingIndex >= 0
        const albums = isAlreadyAdded
          ? list.albums.filter((entry) => entry.id !== albumSummary.id)
          : [albumSummary, ...list.albums].slice(0, listStorageConfig.MAX_ALBUMS_PER_LIST)

        updated = true
        outcome = {
          ok: true,
          added: !isAlreadyAdded,
          listName: list.name,
        }

        return {
          ...list,
          albums,
          updatedAt: Date.now(),
        }
      })

      if (!updated) return prev

      const sorted = [...next].sort((a, b) => b.updatedAt - a.updatedAt)
      persistListsToStorage(sorted)
      return sorted
    })

    return outcome
  }, [])

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
