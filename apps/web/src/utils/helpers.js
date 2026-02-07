import { inferGenresFromSeed } from '../services/ratingsService.js'

export const formatDuration = (ms) => {
  if (!ms || ms === 0) return '–'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const formatReleaseDate = (date, releaseYear) => {
  if (releaseYear) return String(releaseYear)
  if (typeof date === 'string') {
    const trimmed = date.trim()
    const yearMatch = trimmed.match(/\b(19|20)\d{2}\b/)
    if (yearMatch) return yearMatch[0]
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return String(parsed.getFullYear())
  }
  if (typeof date === 'number' && Number.isFinite(date)) {
    return String(date)
  }
  return 'Unknown'
}

export const generateStreamingLinks = (album) => {
  if (!album) return {}
  const artistName = encodeURIComponent(album.artists?.[0] ?? '')
  const albumName = encodeURIComponent(album.name ?? '')

  return {
    spotify: album.external_urls?.spotify,
    appleMusic: `https://music.apple.com/search?term=${artistName}+${albumName}`,
    youtubeMusic: `https://music.youtube.com/search?q=${artistName}+${albumName}`,
    amazonMusic: `https://music.amazon.com/search/${artistName}+${albumName}`,
  }
}

export const inferAlbumGenres = (album) => {
  if (album?.genres?.length) return album.genres
  return inferGenresFromSeed(album)
}

export const debounce = (fn, delay = 300) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export const createSkeletonArray = (count = 8) => Array.from({ length: count })

export const formatLargeNumber = (value = 0) => {
  if (value > 999999) return `${(value / 1000000).toFixed(1)}M`
  if (value > 999) return `${(value / 1000).toFixed(1)}K`
  return value.toString()
}
