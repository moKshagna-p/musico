// Artist photos for album heroes. Apple Music has the best editorial shots and
// motion heroes but no public image API, so we read the artist's public page.
// fanart.tv (with an API key) fills in wide backgrounds, and Deezer's open API
// is the last resort.

import { env } from '../core/env'

// `editorial` art is a wide, art-directed hero; `portrait` is a plain artist photo.
// `video` is Apple's looping HLS motion hero, when the artist has one.
export type ArtistImage = {
  image: string
  source: 'apple' | 'fanart' | 'deezer'
  kind: 'editorial' | 'portrait'
  video: string | null
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

const CACHE_TTL_MS = 1000 * 60 * 60 * 24
const CACHE_MAX_ENTRIES = 2000
const REQUEST_TIMEOUT_MS = 4000
const MUSICBRAINZ_UA = 'musico/1.0 ( https://musico-web.vercel.app )'
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// ponytail: per-isolate memory cache; edge Cache-Control on the route does the heavy lifting. Move to Postgres if hit rate is poor.
const cache = new Map<string, { value: ArtistImage | null; expiresAt: number }>()

export const normalizeName = (value: string) =>
  // Drops Latin accents (é -> e) but keeps every script's letters and marks, so 宇多田ヒカル or ビ survive intact.
  value.normalize('NFKD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim()

const pickByName = <T>(items: T[], name: string, getName: (item: T) => unknown) => {
  const target = normalizeName(name)
  return items.find((item) => normalizeName(String(getName(item) ?? '')) === target)
}

const fetchWithTimeout = (fetcher: Fetcher, url: string, init: RequestInit = {}) =>
  fetcher(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

type AppleArtwork = { url?: unknown; width?: unknown; height?: unknown }

const findAllByKey = (node: unknown, key: string, out: unknown[] = []) => {
  if (Array.isArray(node)) node.forEach((item) => findAllByKey(item, key, out))
  else if (node && typeof node === 'object') {
    for (const [childKey, value] of Object.entries(node)) {
      if (childKey === key && value) out.push(value)
      findAllByKey(value, key, out)
    }
  }
  return out
}

const MZSTATIC_TEMPLATE = /^https:\/\/[a-z0-9-]+\.mzstatic\.com\/image\/thumb\/.+\/\{w\}x\{h\}\{c\}\.\{f\}$/i

// Resolves Apple's `{w}x{h}{c}.{f}` artwork template at up to 2400px wide, keeping the aspect ratio.
export const resolveAppleTemplate = (artwork: AppleArtwork | undefined, maxWidth = 2400) => {
  const url = typeof artwork?.url === 'string' ? artwork.url : ''
  const width = Number(artwork?.width)
  const height = Number(artwork?.height)
  if (!MZSTATIC_TEMPLATE.test(url) || !(width > 0) || !(height > 0)) return null
  const outWidth = Math.min(maxWidth, width)
  const outHeight = Math.round((outWidth * height) / width)
  return url.replace('{w}x{h}{c}.{f}', `${outWidth}x${outHeight}bb.webp`)
}

const APPLE_MOTION_VIDEO = /^https:\/\/mvod\.itunes\.apple\.com\/itunes-assets\/.+\.m3u8$/i

// Prefers art-directed heroes: motion heroes (still plus video), then editorial banners.
export const pickEditorialArtwork = (pageData: unknown) => {
  const motions = findAllByKey(pageData, 'motionArtistFullscreen16x9')
    .map((value) => value as { previewFrame?: AppleArtwork; video?: unknown })
    .map(({ previewFrame, video }) => ({
      artwork: previewFrame,
      video: typeof video === 'string' && APPLE_MOTION_VIDEO.test(video) ? video : null,
    }))
  const banners = findAllByKey(pageData, 'wideArtwork')
    .map((value) => (value as { dictionary?: AppleArtwork }).dictionary)
    .filter((artwork) => typeof artwork?.url === 'string' && /\/thumb\/Features/i.test(artwork.url))
    .map((artwork) => ({ artwork, video: null }))

  for (const { artwork, video } of [...motions, ...banners]) {
    const image = resolveAppleTemplate(artwork)
    if (image) return { image, video }
  }
  return null
}

export const appleArtworkUrl = (ogImage: string, size = 1800) => {
  // Only real artist photos; other og:images are album art or Apple placeholders.
  if (!/^https:\/\/[a-z0-9-]+\.mzstatic\.com\/image\/thumb\/AMCArtistImages/i.test(ogImage)) return null
  return ogImage.replace(/\/\d+x\d+[a-z]*\.(?:png|jpe?g|webp)$/i, `/${size}x${size}bb.webp`)
}

type AppleArt = { wide: ArtistImage | null; portrait: ArtistImage | null }

const readServerData = (html: string) => html.match(/<script[^>]+id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]

// One search result, e.g. { kind: 'album', title: 'Take Care', artist: 'Drake', ... }.
export type AppleSearchItem = { kind: string; title: string; artist: string; url: string; artwork?: AppleArtwork }

type Link = { title?: unknown }
const linkTitles = (links: Link[]) => links.map((link) => String(link?.title ?? '')).join(', ')

const collectSearchItems = (node: unknown, out: AppleSearchItem[] = []) => {
  if (Array.isArray(node)) node.forEach((item) => collectSearchItems(item, out))
  else if (node && typeof node === 'object') {
    const { title, titleLinks, subtitle, subtitleLinks, contentDescriptor, artwork } = node as {
      title?: unknown
      titleLinks?: unknown
      subtitle?: unknown
      subtitleLinks?: unknown
      contentDescriptor?: { kind?: unknown; url?: unknown }
      artwork?: { dictionary?: AppleArtwork }
    }
    // Top results use plain text ("Album · Drake"); the per-kind sections link the title and each artist instead.
    const name = typeof title === 'string' ? title : Array.isArray(titleLinks) ? linkTitles(titleLinks) : ''
    const artist = Array.isArray(subtitleLinks) ? linkTitles(subtitleLinks) : String(subtitle ?? '').split(/\s+·\s+/).slice(1).join(' · ')
    if (name && typeof contentDescriptor?.url === 'string') {
      out.push({ kind: String(contentDescriptor.kind), title: name, artist, url: contentDescriptor.url, artwork: artwork?.dictionary })
    }
    Object.values(node).forEach((value) => collectSearchItems(value, out))
  }
  return out
}

// The iTunes Search API rate-limits Cloudflare's shared egress IPs (HTTP 429), so we read Apple Music's own search page.
export const searchAppleMusic = async (term: string, fetcher: Fetcher, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const response = await fetcher(`https://music.apple.com/us/search?term=${encodeURIComponent(term)}`, {
    headers: { 'User-Agent': BROWSER_UA },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw Object.assign(new Error(`Apple Music search failed (${response.status})`), { status: response.status })
  const serialized = readServerData(await response.text())
  if (!serialized) throw new Error('Apple Music search page has no server data')
  return collectSearchItems(JSON.parse(serialized))
}

const findOnApple = async (name: string, fetcher: Fetcher): Promise<AppleArt | null> => {
  const artists = (await searchAppleMusic(name, fetcher)).filter((item) => item.kind === 'artist')
  const pageUrl = pickByName(artists, name, (item) => item.title)?.url.split('?')[0]
  if (!pageUrl?.startsWith('https://music.apple.com/')) return null

  const pageResponse = await fetchWithTimeout(fetcher, pageUrl, { headers: { 'User-Agent': BROWSER_UA } })
  if (!pageResponse.ok) return null
  const html = await pageResponse.text()

  let wide: ArtistImage | null = null
  const serialized = readServerData(html)
  if (serialized) {
    try {
      const editorial = pickEditorialArtwork(JSON.parse(serialized))
      if (editorial) wide = { ...editorial, source: 'apple', kind: 'editorial' }
    } catch {
      // Apple changed the page payload; the og:image below still works.
    }
  }

  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
  const image = ogImage ? appleArtworkUrl(ogImage) : null
  return { wide, portrait: image ? { image, source: 'apple', kind: 'portrait', video: null } : null }
}

// fanart.tv keys artists by MusicBrainz id and has 1920x1080 backgrounds for many smaller artists.
const findOnFanart = async (name: string, fetcher: Fetcher, apiKey?: string): Promise<ArtistImage | null> => {
  if (!apiKey) return null
  const query = encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`)
  const search = await fetchWithTimeout(fetcher, `https://musicbrainz.org/ws/2/artist/?query=${query}&fmt=json&limit=5`, {
    headers: { 'User-Agent': MUSICBRAINZ_UA, Accept: 'application/json' },
  })
  if (!search.ok) return null
  const { artists = [] } = (await search.json()) as { artists?: Array<{ id?: string; name?: string }> }
  const mbid = pickByName(artists, name, (item) => item.name)?.id
  if (!mbid || !/^[0-9a-f-]{36}$/i.test(mbid)) return null

  const response = await fetchWithTimeout(fetcher, `https://webservice.fanart.tv/v3/music/${mbid}?api_key=${encodeURIComponent(apiKey)}`)
  if (!response.ok) return null
  const { artistbackground = [] } = (await response.json()) as { artistbackground?: Array<{ url?: string; likes?: string }> }
  const url = [...artistbackground]
    .sort((a, b) => Number(b.likes ?? 0) - Number(a.likes ?? 0))
    .map((background) => String(background.url ?? '').replace(/^http:\/\//, 'https://'))
    .find((candidate) => candidate.startsWith('https://assets.fanart.tv/'))
  return url ? { image: url, source: 'fanart', kind: 'editorial', video: null } : null
}

const findOnDeezer = async (name: string, fetcher: Fetcher): Promise<ArtistImage | null> => {
  const response = await fetchWithTimeout(fetcher, `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`)
  if (!response.ok) return null
  const payload = (await response.json()) as { data?: Array<{ name?: string; picture_xl?: string }> }
  const artist = pickByName(payload.data ?? [], name, (item) => item.name)
  const image = artist?.picture_xl
  // Deezer serves a blank silhouette at /images/artist//... for artists without a photo.
  if (!image?.startsWith('https://') || image.includes('/images/artist//')) return null
  return { image, source: 'deezer', kind: 'portrait', video: null }
}

const attempt = async <T>(source: string, name: string, lookup: () => Promise<T | null>) => {
  try {
    return await lookup()
  } catch (error) {
    console.warn('[artist-image] source failed', { source, name, error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

export const findArtistImage = async (
  rawName: string,
  fetcher: Fetcher = fetch,
  fanartKey: string | undefined = env.FANART_API_KEY,
): Promise<ArtistImage | null> => {
  const name = rawName.trim()
  const key = normalizeName(name)
  if (!key) return null

  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  // Wide art beats a square photo, whichever source it comes from.
  const apple = await attempt('apple', name, () => findOnApple(name, fetcher))
  const value =
    apple?.wide ??
    (await attempt('fanart', name, () => findOnFanart(name, fetcher, fanartKey))) ??
    apple?.portrait ??
    (await attempt('deezer', name, () => findOnDeezer(name, fetcher)))

  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  return value
}
