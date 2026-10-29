import { z } from 'zod'

import { validatedRequest } from './apiClient.js'
import { API_BASE_URL } from './authClient.js'

const ArtistImageSchema = z.object({
  image: z.string().url().nullable(),
  source: z.enum(['apple', 'fanart', 'deezer']).nullable(),
  kind: z.enum(['editorial', 'portrait']).nullable(),
  video: z.string().url().nullable().optional(),
})

// Discogs disambiguates duplicate names as "Artist (2)" and marks name variations with "*".
export const cleanArtistName = (name = '') => String(name).replace(/\s*\(\d+\)$/, '').replace(/\*$/, '').trim()

export const getArtistLogo = async (name) => {
  const data = await validatedRequest({ url: '/api/artist-logo', params: { name: cleanArtistName(name) } }, z.object({ logo: z.string().url().nullable() }))
  return data?.logo ?? null
}

// The same logo served from our API, which lets the page read its pixels.
export const artistLogoImageUrl = (name) => `${API_BASE_URL}/api/artist-logo/image?name=${encodeURIComponent(cleanArtistName(name))}`

export const getArtistImage = async (name) => {
  const data = await validatedRequest({ url: '/api/artist-image', params: { name: cleanArtistName(name) } }, ArtistImageSchema)
  return data?.image ? { image: data.image, kind: data.kind ?? 'portrait', video: data.video ?? null } : null
}
