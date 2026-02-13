const baseGenres = [
  'Neo-Soul',
  'Jazztronica',
  'Alt R&B',
  'Analog House',
  'Indie Electronic',
  'Future Funk',
  'Atmospheric Pop',
  'Chillwave',
]

const seedFromString = (value = '') => {
  const stringValue = String(value || '')
  return stringValue.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 997, 7)
}

export const inferGenresFromSeed = (album) => {
  const list = new Set()
  const seed = seedFromString(album?.id ?? album?.name ?? '')
  const first = baseGenres[seed % baseGenres.length]
  const second = baseGenres[(seed * 3) % baseGenres.length]
  list.add(first)
  if (second !== first) {
    list.add(second)
  }
  if (album?.album_type === 'single') {
    list.add('Collector Cut')
  }
  if ((album?.total_tracks ?? 0) > 16) {
    list.add('Extended Edition')
  }
  return Array.from(list)
}
