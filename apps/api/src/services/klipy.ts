// GIF search for reviews. The key stays on the server and results are cached, since a fresh KLIPY key
// starts at ~100 calls an hour. Picked GIFs are hotlinked from KLIPY's CDN, never copied into R2.

import { LRUCache } from 'lru-cache'

import { env } from '../core/env'

export type Gif = { id: string; title: string; url: string; preview: string; width: number; height: number }

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>
type KlipyFile = { url?: unknown; width?: unknown; height?: unknown }
type KlipySize = { gif?: KlipyFile; webp?: KlipyFile }
type KlipyItem = { id?: unknown; title?: unknown; file?: { hd?: KlipySize; md?: KlipySize; sm?: KlipySize; xs?: KlipySize } }

const API_BASE = 'https://api.klipy.com/api/v1'
const PER_PAGE = 24
const REQUEST_TIMEOUT_MS = 5000

// ponytail: per-isolate cache; trending and common searches repeat a lot. Move to Postgres if the key's hourly cap bites.
const cache = new LRUCache<string, Gif[]>({ max: 500, ttl: 1000 * 60 * 60 })

const readFile = (file: KlipyFile | undefined) => {
  const width = Number(file?.width)
  const height = Number(file?.height)
  return typeof file?.url === 'string' && width > 0 && height > 0 ? { url: file.url, width, height } : null
}

// WebP is a fraction of the GIF's size and animates everywhere we support; GIF is the fallback.
const pick = (size: KlipySize | undefined) => readFile(size?.webp) ?? readFile(size?.gif)

// Ads and malformed items have no usable file and are dropped.
export const toGif = (item: KlipyItem): Gif | null => {
  const full = pick(item.file?.md) ?? pick(item.file?.hd)
  const preview = pick(item.file?.sm) ?? pick(item.file?.xs) ?? full
  if (item.id === undefined || item.id === null || !full || !preview) return null
  return {
    id: String(item.id),
    title: typeof item.title === 'string' ? item.title : '',
    url: full.url,
    preview: preview.url,
    width: full.width,
    height: full.height,
  }
}

export const searchGifs = async (query: string, page: number, fetcher: Fetcher = fetch): Promise<Gif[] | null> => {
  const key = env.KLIPY_API_KEY
  if (!key) return null

  const cacheKey = `${query.toLowerCase()}|${page}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) })
  if (query) params.set('q', query)
  const url = `${API_BASE}/${encodeURIComponent(key)}/gifs/${query ? 'search' : 'trending'}?${params}`
  const response = await fetcher(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`KLIPY responded ${response.status}`)

  const body = (await response.json()) as { data?: { data?: KlipyItem[] } }
  const gifs = (body.data?.data ?? []).map(toGif).filter((gif): gif is Gif => gif !== null)
  cache.set(cacheKey, gifs)
  return gifs
}
