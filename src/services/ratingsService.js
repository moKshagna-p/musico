const STORAGE_KEY = 'vaultAlbumRatings'

const isBrowser = typeof window !== 'undefined'

const safeParse = (value) => {
  try {
    return JSON.parse(value ?? '{}')
  } catch (error) {
    console.warn('Unable to parse ratings from storage', error)
    return {}
  }
}

export const loadRatingsFromStorage = () => {
  if (!isBrowser) return {}
  return safeParse(window.localStorage.getItem(STORAGE_KEY))
}

export const persistRatingsToStorage = (ratings) => {
  if (!isBrowser) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings))
  } catch (error) {
    console.warn('Unable to persist ratings', error)
  }
}

export const persistRating = (albumId, rating) => {
  if (!isBrowser) return
  const ratings = loadRatingsFromStorage()
  ratings[albumId] = {
    rating,
    timestamp: Date.now(),
  }
  persistRatingsToStorage(ratings)
}

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

export const generateCommunitySnapshot = (album, userRating) => {
  const popularity = album?.popularity ?? 52
  const seed = seedFromString(album?.id ?? album?.name ?? '')
  const baseRating = 3.2 + (popularity / 100) * 1.4 + (seed % 20) / 100
  const rating = Math.min(5, Math.max(1.2, baseRating + (userRating ? userRating / 50 : 0)))
  const total = 120 + Math.round(popularity * 6) + (seed % 90)

  return {
    average: Number(rating.toFixed(1)),
    total,
  }
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
