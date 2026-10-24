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
    spotify: album.external_urls?.spotify || `https://open.spotify.com/search/${encodeURIComponent(`${album.artists?.[0] ?? ''} ${album.name ?? ''}`.trim())}`,
    appleMusic: `https://music.apple.com/search?term=${artistName}+${albumName}`,
    youtubeMusic: `https://music.youtube.com/search?q=${artistName}+${albumName}`,
    amazonMusic: `https://music.amazon.com/search/${artistName}+${albumName}`,
  }
}

export const inferAlbumGenres = (album) => {
  if (album?.genres?.length) return album.genres
  return inferGenresFromSeed(album)
}

export const createSkeletonArray = (count = 8) => Array.from({ length: count })

export const formatLargeNumber = (value = 0) => {
  if (value > 999999) return `${(value / 1000000).toFixed(1)}M`
  if (value > 999) return `${(value / 1000).toFixed(1)}K`
  return value.toString()
}

// Apple's image CDN renders any size named in the URL; other hosts (Discogs URLs are signed) are used as given.
const APPLE_COVER = /^(https:\/\/[a-z0-9-]+\.mzstatic\.com\/image\/thumb\/.+)\/\d+x\d+[a-z]*\.(?:jpe?g|png|webp)$/i
const COVER_WIDTHS = [300, 600, 1200]

export const coverAt = (src, size) => {
  const match = src?.match(APPLE_COVER)
  return match ? `${match[1]}/${size}x${size}bb.webp` : src
}

export const coverSrcSet = (src) =>
  APPLE_COVER.test(src ?? '') ? COVER_WIDTHS.map((size) => `${coverAt(src, size)} ${size}w`).join(', ') : undefined
