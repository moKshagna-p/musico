// Discogs disambiguates duplicate names as "Artist (2)" and marks name variations with "*".
// No imports, so the mobile app can share it.
export const cleanArtistName = (name = '') => String(name).replace(/\s*\(\d+\)$/, '').replace(/\*$/, '').trim()
