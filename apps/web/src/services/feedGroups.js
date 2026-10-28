// Activity closer together than this, by the same person on the same day, reads as one sitting.
const BURST_GAP_MS = 60 * 60 * 1000

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

// Feed items arrive newest first. Runs of one person's activity become a single group, and
// everything they did to one album in that run (rating, review, list adds) becomes one entry.
export const groupFeed = (items) => {
  const groups = []
  for (const item of items) {
    let group = groups.at(-1)
    const previous = group?.lastAt
    if (!group || group.userId !== item.userId || previous - item.createdAt > BURST_GAP_MS || !sameDay(previous, item.createdAt)) {
      group = { id: item.id, userId: item.userId, user: item.user, createdAt: item.createdAt, albums: [], follows: [] }
      groups.push(group)
    }
    group.lastAt = item.createdAt

    if (item.type === 'followed') {
      if (item.targetUser && !group.follows.some((person) => person.username === item.targetUser.username)) group.follows.push(item.targetUser)
      continue
    }
    if (!item.albumId) continue

    let album = group.albums.find((entry) => entry.albumId === item.albumId)
    if (!album) {
      album = { albumId: item.albumId, albumName: item.albumName, albumCover: item.albumCover, rating: 0, snippet: '', reviewed: false, lists: [] }
      group.albums.push(album)
    }
    // Newer items come first, so the first rating or review seen is the current one.
    const metadata = item.metadata ?? {}
    if (item.type === 'rated' && !album.rating) album.rating = Number(metadata.rating ?? 0)
    if (item.type === 'reviewed' && !album.reviewed) {
      album.reviewed = true
      album.snippet = metadata.snippet ?? ''
    }
    if (item.type === 'listed' && !album.lists.some((list) => list.listName === metadata.listName)) {
      album.lists.push({ listId: metadata.listId, listName: metadata.listName })
    }
  }
  return groups.filter((group) => group.albums.length || group.follows.length)
}

const weekdayFormat = new Intl.DateTimeFormat('en', { weekday: 'long' })
const dateFormat = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' })
const fullDateFormat = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' })

export const dayLabel = (timestamp, now = Date.now()) => {
  const start = (time) => new Date(new Date(time).toDateString()).getTime()
  const days = Math.round((start(now) - start(timestamp)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return weekdayFormat.format(timestamp)
  return new Date(timestamp).getFullYear() === new Date(now).getFullYear() ? dateFormat.format(timestamp) : fullDateFormat.format(timestamp)
}

// Groups never cross midnight, so splitting them into days is a simple run-length pass.
export const feedDays = (groups, now = Date.now()) => {
  const days = []
  for (const group of groups) {
    const label = dayLabel(group.createdAt, now)
    if (days.at(-1)?.label === label) days.at(-1).groups.push(group)
    else days.push({ label, groups: [group] })
  }
  return days
}
