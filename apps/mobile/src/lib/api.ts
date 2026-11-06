import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'
import * as SecureStore from 'expo-secure-store'

// Shared with the web (no imports there, so it bundles here too).
import { cleanArtistName } from '../../../web/src/utils/artistName.js'

// The web app's origin proxies /api/* to the API (Vercel rewrite), so the app talks to the same place the site does.
// Local API: EXPO_PUBLIC_API_URL=http://10.0.2.2:4000 (Android emulator) or http://<your LAN IP>:4000 (a phone).
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://musico-web.vercel.app').replace(/\/$/, '')

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  disableCookieCache: true,
  plugins: [expoClient({ scheme: 'musico', storagePrefix: 'musico', storage: SecureStore })],
})

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type Params = Record<string, string | number | boolean | null | undefined>
type Options = { method?: string; params?: Params; body?: unknown; signal?: AbortSignal }

// Same contract as the web's axios client: resolves to the JSON body, rejects with the API's `error` message.
// The session lives in SecureStore (expoClient); it rides along as a Cookie header, as Better Auth's Expo guide does.
export const api = async <T = any>(path: string, { method = 'GET', params, body, signal }: Options = {}): Promise<T> => {
  const query = Object.entries(params ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  const cookie = authClient.getCookie()
  const response = await fetch(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`, {
    method,
    signal,
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
      ...(cookie ? { Cookie: cookie } : null),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.error || 'Something went wrong.', response.status)
  return data as T
}

export type Album = {
  id: string
  name: string
  artists: string[]
  cover?: string | null
  discLabel?: string | null
  releaseYear?: number | null
  releaseDate?: string | null
  genres?: string[]
  communityRating?: number
  reviewCount?: number
  tracks?: { id?: string; track_number?: number; name: string; duration_ms?: number }[]
}


export const getHomeSections = async () => {
  const response = await api('/api/home', { params: { happeningLimit: 24, recentLimit: 24 } })
  return {
    mostHappening: (response?.mostHappening?.data ?? []) as Album[],
    recentReleases: (response?.recentReleases?.data ?? []) as Album[],
    error: (response?.mostHappening?.error ?? response?.recentReleases?.error ?? null) as string | null,
  }
}

export const getRecentPopular = async () =>
  ((await api('/api/featured', { params: { limit: 24, mode: 'recent-popular' } }))?.data ?? []) as Album[]

export const searchReleases = async (q: string, offset = 0) => {
  const response = await api('/api/search', { params: { q, limit: 12, offset } })
  return {
    data: (response?.data ?? []) as Album[],
    correctedQuery: (response?.correctedQuery ?? null) as string | null,
    nextOffset: response?.hasMore && response?.nextOffset != null ? Number(response.nextOffset) : undefined,
  }
}

export const getRelease = (id: string) => api<Album>(`/api/releases/${encodeURIComponent(id)}`)

export const getStreamingLinks = async (artist: string, album: string) =>
  ((await api('/api/streaming-links', { params: { artist, album } }))?.links ?? {}) as Record<string, string>

export type ArtistArt = { image: string; kind: 'editorial' | 'portrait'; square?: { image: string } | null }
export const getArtistImage = async (name: string): Promise<ArtistArt | null> => {
  const data = await api('/api/artist-image', { params: { name: cleanArtistName(name) } })
  return data?.image ? { image: data.image, kind: data.kind ?? 'portrait', square: data.square ?? null } : null
}

export const getArtistLogo = async (name: string): Promise<string | null> =>
  (await api('/api/artist-logo', { params: { name: cleanArtistName(name) } }))?.logo ? `${API_BASE_URL}/api/artist-logo/image?name=${encodeURIComponent(cleanArtistName(name))}` : null

// Search links hold each button until the album's own page is known, and stay for platforms without one.
export const searchStreamingLinks = (album?: Album | null): Record<string, string> => {
  if (!album) return {}
  const artist = encodeURIComponent(album.artists?.[0] ?? '')
  const name = encodeURIComponent(album.name ?? '')
  return {
    spotify: `https://open.spotify.com/search/${encodeURIComponent(`${album.artists?.[0] ?? ''} ${album.name ?? ''}`.trim())}`,
    appleMusic: `https://music.apple.com/search?term=${artist}+${name}`,
    youtubeMusic: `https://music.youtube.com/search?q=${artist}+${name}`,
    amazonMusic: `https://music.amazon.com/search/${artist}+${name}`,
  }
}

export const fetchBootstrap = async () => {
  try {
    return (await api('/api/me/bootstrap'))?.data ?? null
  } catch (error) {
    if ((error as ApiError).status === 401) return null
    throw error
  }
}

export const saveRating = async (albumId: string, rating: number, meta: { albumName?: string; albumCover?: string | null }) =>
  (await api(`/api/me/ratings/${encodeURIComponent(albumId)}`, { method: 'PUT', body: { rating, ...meta } }))?.data ?? null

export const deleteRating = async (albumId: string) =>
  (await api(`/api/me/ratings/${encodeURIComponent(albumId)}`, { method: 'DELETE' }))?.data ?? null

export const createList = async (name: string, album?: object) =>
  (await api('/api/me/lists', { method: 'POST', body: album ? { name, album } : { name } }))?.data ?? null

export const toggleListAlbum = async (listId: string, album: object) =>
  (await api(`/api/me/lists/${encodeURIComponent(listId)}/toggle`, { method: 'POST', body: album }))?.data ?? { added: false }

export const fetchAlbumReviews = async (albumId: string, cursor?: string) => {
  const response = await api(`/api/albums/${encodeURIComponent(albumId)}/reviews`, { params: { limit: 10, cursor } })
  return { reviews: (response?.data ?? []) as any[], nextCursor: (response?.nextCursor ?? undefined) as string | undefined }
}

// media: [{ id, alt }] from uploadReviewImage, or gif: a picked GIF. Never both (same contract as the web).
export type ReviewGif = { url: string; width: number; height: number; alt: string }
export const saveReview = async (albumId: string, body: { content: string; albumName: string; albumCover?: string | null; albumArtists?: string[]; media: { id: string; alt: string }[]; gif: ReviewGif | null }) =>
  (await api(`/api/me/reviews/${encodeURIComponent(albumId)}`, { method: 'PUT', body }))?.data ?? null

// Multipart, so no JSON Content-Type: fetch adds the boundary itself.
export const uploadReviewImage = async ({ uri, width, height, mimeType }: { uri: string; width: number; height: number; mimeType: string }) => {
  const form = new FormData()
  form.append('file', { uri, name: `review.${mimeType.split('/')[1] ?? 'jpg'}`, type: mimeType } as unknown as Blob)
  form.append('width', String(width))
  form.append('height', String(height))
  const cookie = authClient.getCookie()
  const response = await fetch(`${API_BASE_URL}/api/me/media`, { method: 'POST', body: form, credentials: 'omit', headers: cookie ? { Cookie: cookie } : undefined })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.error || 'Upload failed.', response.status)
  return data.data as { id: string }
}

export type Gif = { id: string; url: string; preview: string; width: number; height: number; title?: string }
export const searchGifs = async (q: string) => ((await api('/api/gifs', { params: { q, page: 1 } }))?.data ?? []) as Gif[]

export const fetchFeed = (cursor?: string) => api('/api/me/feed', { params: { cursor, limit: 20 } })
export const fetchDashboard = () => api('/api/me/dashboard')
export const fetchUserProfile = async (username: string) => (await api(`/api/users/${encodeURIComponent(username)}`))?.data ?? null
export const fetchPublicList = async (listId: string) => (await api(`/api/lists/${encodeURIComponent(listId)}`))?.data ?? null
export const toggleFollow = async (username: string) =>
  ((await api(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'POST' }))?.data ?? { following: false }) as { following: boolean }
export const searchUsers = async (q: string) => {
  try {
    return ((await api('/api/users/search', { params: { q, limit: 20 } }))?.data ?? []) as any[]
  } catch {
    return []
  }
}
export const checkUsername = async (username: string) => (await api('/api/username/check', { params: { username } }))?.data
export const fetchFollowers = async () => ((await api('/api/me/followers').catch(() => null))?.data ?? []) as any[]
export const fetchFollowing = async () => ((await api('/api/me/following').catch(() => null))?.data ?? []) as any[]
export const fetchRatingsHistory = async (cursor?: string) => {
  const response = await api('/api/me/ratings/history', { params: { limit: 36, cursor } })
  return { items: (response?.data ?? []) as any[], nextCursor: (response?.nextCursor ?? undefined) as string | undefined }
}
export const updateProfile = async (payload: { username?: string; bio?: string; image?: string; cover?: string }) =>
  (await api('/api/me/profile', { method: 'PUT', body: payload }))?.data ?? null
