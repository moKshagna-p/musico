import { z } from 'zod'

import { validatedRequest } from './apiClient.js'

const ArtistImageSchema = z.object({
  image: z.string().url().nullable(),
  source: z.enum(['apple', 'deezer']).nullable(),
  kind: z.enum(['editorial', 'portrait']).nullable(),
})

// Discogs disambiguates duplicate names as "Artist (2)" and marks name variations with "*".
export const cleanArtistName = (name = '') => String(name).replace(/\s*\(\d+\)$/, '').replace(/\*$/, '').trim()

export const getArtistImage = async (name) => {
  const data = await validatedRequest({ url: '/api/artist-image', params: { name: cleanArtistName(name) } }, ArtistImageSchema)
  return data?.image ? { image: data.image, kind: data.kind ?? 'portrait' } : null
}
