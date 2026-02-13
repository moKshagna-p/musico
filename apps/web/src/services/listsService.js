const MAX_LISTS = 30
const MAX_LIST_NAME_LENGTH = 48
const MAX_ALBUMS_PER_LIST = 200

export const normalizeListName = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_LIST_NAME_LENGTH)

export const toListAlbumSummary = (album) => {
  const id = String(album?.id ?? '').trim()
  if (!id) return null

  return {
    id,
    name: String(album?.name ?? 'Untitled').trim() || 'Untitled',
    cover: String(album?.cover ?? '').trim(),
    artists: Array.isArray(album?.artists) ? album.artists.filter(Boolean).map(String).slice(0, 3) : [],
    releaseYear: typeof album?.releaseYear === 'number' && Number.isFinite(album.releaseYear) ? album.releaseYear : null,
    addedAt: Number.isFinite(Number(album?.addedAt)) ? Number(album.addedAt) : Date.now(),
  }
}

export const listStorageConfig = {
  MAX_LISTS,
  MAX_ALBUMS_PER_LIST,
}
