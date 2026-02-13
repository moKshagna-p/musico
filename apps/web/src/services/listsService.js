const LISTS_STORAGE_KEY = 'vaultLists'
const MAX_LISTS = 30
const MAX_LIST_NAME_LENGTH = 48
const MAX_ALBUMS_PER_LIST = 200

const isBrowser = typeof window !== 'undefined'

const safeParse = (value) => {
  try {
    return JSON.parse(value ?? '[]')
  } catch {
    return []
  }
}

export const normalizeListName = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_LIST_NAME_LENGTH)

const createListId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `list_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const normalizeAlbums = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => ({
      id: String(entry?.id ?? '').trim(),
      name: String(entry?.name ?? 'Untitled').trim() || 'Untitled',
      cover: String(entry?.cover ?? '').trim(),
      artists: Array.isArray(entry?.artists) ? entry.artists.filter(Boolean).map(String).slice(0, 3) : [],
      releaseYear:
        typeof entry?.releaseYear === 'number' && Number.isFinite(entry.releaseYear) ? entry.releaseYear : null,
      addedAt: Number.isFinite(Number(entry?.addedAt)) ? Number(entry.addedAt) : Date.now(),
    }))
    .filter((album) => album.id)
    .slice(0, MAX_ALBUMS_PER_LIST)
}

const normalizeListEntry = (value) => {
  const id = String(value?.id ?? '').trim()
  const name = normalizeListName(value?.name)
  if (!id || !name) return null

  const createdAt = Number.isFinite(Number(value?.createdAt)) ? Number(value.createdAt) : Date.now()
  const updatedAt = Number.isFinite(Number(value?.updatedAt)) ? Number(value.updatedAt) : createdAt

  return {
    id,
    name,
    albums: normalizeAlbums(value?.albums),
    createdAt,
    updatedAt,
  }
}

export const loadListsFromStorage = () => {
  if (!isBrowser) return []
  const parsed = safeParse(window.localStorage.getItem(LISTS_STORAGE_KEY))
  if (!Array.isArray(parsed)) return []
  return parsed.map(normalizeListEntry).filter(Boolean)
}

export const persistListsToStorage = (lists) => {
  if (!isBrowser) return
  try {
    window.localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(lists))
  } catch {
    // Ignore storage errors.
  }
}

export const toListAlbumSummary = (album) => {
  const id = String(album?.id ?? '').trim()
  if (!id) return null

  return {
    id,
    name: String(album?.name ?? 'Untitled').trim() || 'Untitled',
    cover: String(album?.cover ?? '').trim(),
    artists: Array.isArray(album?.artists) ? album.artists.filter(Boolean).map(String).slice(0, 3) : [],
    releaseYear: typeof album?.releaseYear === 'number' && Number.isFinite(album.releaseYear) ? album.releaseYear : null,
    addedAt: Date.now(),
  }
}

export const buildNewList = (name) => {
  const normalized = normalizeListName(name)
  if (!normalized) return null

  const now = Date.now()
  return {
    id: createListId(),
    name: normalized,
    albums: [],
    createdAt: now,
    updatedAt: now,
  }
}

export const listStorageConfig = {
  MAX_LISTS,
  MAX_ALBUMS_PER_LIST,
}
