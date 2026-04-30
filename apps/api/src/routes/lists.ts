import { Elysia } from 'elysia'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../core/db'
import {
  user,
  userProfile,
  userList,
  userListAlbum,
} from '../core/schema'
import {
  ensureAuthenticated,
  normalizeListName,
  getCanonicalAlbumMetadata,
  recordActivity,
  getReleasePreviewMap,
} from '../core/utils'
import { MAX_LISTS_PER_USER, MAX_ALBUMS_PER_LIST } from '../core/constants'

export const listRoutes = new Elysia({ prefix: '/api' })
  .get('/me/lists', async ({ request, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const lists = await db.select().from(userList).where(eq(userList.userId, authUser.id))
    if (!lists.length) {
      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return { data: [] }
    }

    const listIds = lists.map((entry) => entry.id)
    const albums = await db.select().from(userListAlbum).where(inArray(userListAlbum.listId, listIds))
    const albumsByList = new Map<string, typeof albums>()

    albums.forEach((entry) => {
      const group = albumsByList.get(entry.listId) ?? []
      group.push(entry)
      albumsByList.set(entry.listId, group)
    })

    const data = [...lists]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((list) => {
        const listAlbums = (albumsByList.get(list.id) ?? [])
          .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
          .map((album) => {
            return {
              id: album.albumId,
              name: album.name,
              cover: album.cover,
              artists: Array.isArray(album.artists) ? album.artists : [],
              releaseYear: album.releaseYear,
              addedAt: album.addedAt.getTime(),
            }
          })

        return {
          id: list.id,
          name: list.name,
          albums: listAlbums,
          createdAt: list.createdAt.getTime(),
          updatedAt: list.updatedAt.getTime(),
        }
      })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return { data }
  })
  .post('/me/lists', async ({ request, body, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const typedBody = body as {
      name?: unknown
      album?: {
        id?: unknown
        name?: unknown
        cover?: unknown
        artists?: unknown
        releaseYear?: unknown
      }
    }

    const name = normalizeListName(typedBody?.name)
    const initialAlbum = typedBody?.album
    const initialAlbumId = String(initialAlbum?.id ?? '').trim()
    if (!name) {
      set.status = 400
      return { error: 'List name is required.' }
    }

    const currentLists = await db.select().from(userList).where(eq(userList.userId, authUser.id))
    if (currentLists.length >= MAX_LISTS_PER_USER) {
      set.status = 400
      return { error: 'List limit reached.' }
    }

    const duplicate = currentLists.some((entry) => entry.name.toLowerCase() === name.toLowerCase())
    if (duplicate) {
      set.status = 409
      return { error: 'List name already exists.' }
    }

    const now = new Date()
    const created = {
      id: crypto.randomUUID(),
      userId: authUser.id,
      name,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(userList).values(created)

    let initialAlbumEntry: {
      id: string
      name: string
      cover: string
      artists: string[]
      releaseYear: number | null
      addedAt: number
    } | null = null

    if (initialAlbumId) {
      const albumMeta = await getCanonicalAlbumMetadata(initialAlbumId, {
        name: initialAlbum?.name,
        cover: initialAlbum?.cover,
        artists: initialAlbum?.artists,
        releaseYear: initialAlbum?.releaseYear,
      })

      await db.insert(userListAlbum).values({
        id: crypto.randomUUID(),
        listId: created.id,
        albumId: initialAlbumId,
        name: albumMeta.name,
        cover: albumMeta.cover,
        artists: albumMeta.artists,
        releaseYear: albumMeta.releaseYear,
        addedAt: now,
      })

      recordActivity({
        userId: authUser.id,
        type: 'listed',
        albumId: initialAlbumId,
        albumName: albumMeta.name,
        albumCover: albumMeta.cover,
        metadata: { listName: created.name, listId: created.id },
      })

      initialAlbumEntry = {
        id: initialAlbumId,
        name: albumMeta.name,
        cover: albumMeta.cover,
        artists: albumMeta.artists,
        releaseYear: albumMeta.releaseYear,
        addedAt: now.getTime(),
      }
    }

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        id: created.id,
        name: created.name,
        albums: initialAlbumEntry ? [initialAlbumEntry] : [],
        createdAt: created.createdAt.getTime(),
        updatedAt: created.updatedAt.getTime(),
        added: Boolean(initialAlbumEntry),
      },
    }
  })
  .post('/me/lists/:listId/toggle', async ({ request, params, body, set }) => {
    const authUser = await ensureAuthenticated(request, set)
    if (!authUser) return { error: 'Unauthorized.' }

    const listId = String(params?.listId ?? '').trim()
    const album = body as {
      id?: unknown
      name?: unknown
      cover?: unknown
      artists?: unknown
      releaseYear?: unknown
    }
    const albumId = String(album?.id ?? '').trim()

    if (!listId || !albumId) {
      set.status = 400
      return { error: 'Missing list id or album id.' }
    }

    const lists = await db
      .select({ id: userList.id, name: userList.name })
      .from(userList)
      .where(and(eq(userList.id, listId), eq(userList.userId, authUser.id)))
      .limit(1)

    const targetList = lists[0]
    if (!targetList) {
      set.status = 404
      return { error: 'List not found.' }
    }

    const existing = await db
      .select({ id: userListAlbum.id })
      .from(userListAlbum)
      .where(and(eq(userListAlbum.listId, listId), eq(userListAlbum.albumId, albumId)))
      .limit(1)

    const now = new Date()

    if (existing[0]) {
      await db.delete(userListAlbum).where(eq(userListAlbum.id, existing[0].id))
      await db.update(userList).set({ updatedAt: now }).where(eq(userList.id, listId))

      set.headers ??= {}
      set.headers['Cache-Control'] = 'no-store'
      return {
        data: {
          added: false,
          listName: targetList.name,
        },
      }
    }

    const [currentCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userListAlbum)
      .where(eq(userListAlbum.listId, listId))

    if (Number(currentCountRow?.count ?? 0) >= MAX_ALBUMS_PER_LIST) {
      set.status = 400
      return { error: 'This list is full.' }
    }

    const albumMeta = await getCanonicalAlbumMetadata(albumId, {
      name: album?.name,
      cover: album?.cover,
      artists: album?.artists,
      releaseYear: album?.releaseYear,
    })

    await db.insert(userListAlbum).values({
      id: crypto.randomUUID(),
      listId,
      albumId,
      name: albumMeta.name,
      cover: albumMeta.cover,
      artists: albumMeta.artists,
      releaseYear: albumMeta.releaseYear,
      addedAt: now,
    })
    await db.update(userList).set({ updatedAt: now }).where(eq(userList.id, listId))

    // Record activity for the feed
    recordActivity({
      userId: authUser.id,
      type: 'listed',
      albumId,
      albumName: albumMeta.name,
      albumCover: albumMeta.cover,
      metadata: { listName: targetList.name, listId },
    })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    return {
      data: {
        added: true,
        listName: targetList.name,
      },
    }
  })
  .get('/lists/:listId', async ({ params, set }) => {
    const listId = String(params?.listId ?? '').trim()
    if (!listId) {
      set.status = 400
      return { error: 'Missing list id.' }
    }

    const lists = await db.select().from(userList).where(eq(userList.id, listId)).limit(1)
    const targetList = lists[0]
    if (!targetList) {
      set.status = 404
      return { error: 'List not found.' }
    }

    // Check if the owner's profile is public
    const ownerProfiles = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, targetList.userId))
      .limit(1)
    const ownerProfile = ownerProfiles[0]
    if (ownerProfile && !ownerProfile.isPublic) {
      set.status = 404
      return { error: 'List not found.' }
    }

    // Fetch owner info
    const owners = await db.select().from(user).where(eq(user.id, targetList.userId)).limit(1)
    const owner = owners[0]

    // Fetch albums
    const albums = await db
      .select()
      .from(userListAlbum)
      .where(eq(userListAlbum.listId, listId))

    const releasePreviewMap = await getReleasePreviewMap(albums.map((album) => album.albumId))

    const sortedAlbums = [...albums]
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
      .map((a) => {
        const preview = releasePreviewMap.get(a.albumId)
        return {
          id: a.albumId,
          name: preview?.name || a.name,
          cover: preview?.cover || a.cover,
          artists: preview?.artists?.length ? preview.artists : Array.isArray(a.artists) ? a.artists : [],
          releaseYear: preview?.releaseYear ?? a.releaseYear,
          addedAt: a.addedAt.getTime(),
        }
      })

    set.headers ??= {}
    set.headers['Cache-Control'] = 'public, max-age=60'
    return {
      data: {
        id: targetList.id,
        name: targetList.name,
        owner: {
          id: targetList.userId,
          name: owner?.name || 'Unknown',
          username: ownerProfile?.username || null,
        },
        albums: sortedAlbums,
        createdAt: targetList.createdAt.getTime(),
        updatedAt: targetList.updatedAt.getTime(),
      },
    }
  })
