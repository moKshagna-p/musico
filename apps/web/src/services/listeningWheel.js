import { toListAlbumSummary } from './listsService.js'

export const mergeWheelAlbums = (...groups) => {
  const albums = new Map()
  for (const album of groups.flat()) {
    const summary = toListAlbumSummary(album)
    if (summary && !albums.has(summary.id)) albums.set(summary.id, summary)
  }
  return [...albums.values()]
}

export const planWheelSpin = (albums, visible, rotation, random = Math.random) => {
  if (!albums.length) return null
  const winner = albums[Math.min(albums.length - 1, Math.floor(random() * albums.length))]
  const display = visible.filter(album => albums.some(item => item.id === album.id)).slice(0, 8)
  if (!display.some(album => album.id === winner.id)) {
    if (display.length === 8) display.pop()
    display.push(winner)
  }
  const slot = display.findIndex(album => album.id === winner.id)
  const landing = (360 - slot * 360 / display.length) % 360
  const normalized = ((rotation % 360) + 360) % 360
  return { winner, display, rotation: rotation + 360 * 5 + ((landing - normalized + 360) % 360) }
}
