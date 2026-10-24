// Artist photos for album heroes. Apple Music has the best editorial shots but
// no public image API, so we read the og:image off the artist's public page.
// Deezer's open API is the fallback.

// `editorial` art is a wide, art-directed hero; `portrait` is a plain artist photo.
export type ArtistImage = { image: string; source: 'apple' | 'deezer'; kind: 'editorial' | 'portrait' }

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

const CACHE_TTL_MS = 1000 * 60 * 60 * 24
const CACHE_MAX_ENTRIES = 2000
const REQUEST_TIMEOUT_MS = 4000
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// ponytail: per-isolate memory cache; edge Cache-Control on the route does the heavy lifting. Move to Postgres if hit rate is poor.
const cache = new Map<string, { value: ArtistImage | null; expiresAt: number }>()

export const normalizeName = (value: string) =>
  value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

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

// Prefers art-directed heroes: editorial banners, then motion-hero stills.
export const pickEditorialArtwork = (pageData: unknown) => {
  const banners = findAllByKey(pageData, 'wideArtwork')
    .map((value) => (value as { dictionary?: AppleArtwork }).dictionary)
    .filter((artwork) => typeof artwork?.url === 'string' && /\/thumb\/Features/i.test(artwork.url))
  const motionStills = findAllByKey(pageData, 'motionArtistFullscreen16x9')
    .map((value) => (value as { previewFrame?: AppleArtwork }).previewFrame)

  for (const artwork of [...banners, ...motionStills]) {
    const image = resolveAppleTemplate(artwork)
    if (image) return image
  }
  return null
}

export const appleArtworkUrl = (ogImage: string, size = 1800) => {
  // Only real artist photos; other og:images are album art or Apple placeholders.
  if (!/^https:\/\/[a-z0-9-]+\.mzstatic\.com\/image\/thumb\/AMCArtistImages/i.test(ogImage)) return null
  return ogImage.replace(/\/\d+x\d+[a-z]*\.(?:png|jpe?g|webp)$/i, `/${size}x${size}bb.webp`)
}

const findOnApple = async (name: string, fetcher: Fetcher): Promise<ArtistImage | null> => {
  const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=5`
  const searchResponse = await fetchWithTimeout(fetcher, searchUrl)
  if (!searchResponse.ok) return null
  const payload = (await searchResponse.json()) as { results?: Array<{ artistName?: string; artistLinkUrl?: string }> }
  const artist = pickByName(payload.results ?? [], name, (item) => item.artistName)
  const pageUrl = artist?.artistLinkUrl?.split('?')[0]
  if (!pageUrl?.startsWith('https://music.apple.com/')) return null

  const pageResponse = await fetchWithTimeout(fetcher, pageUrl, { headers: { 'User-Agent': BROWSER_UA } })
  if (!pageResponse.ok) return null
  const html = await pageResponse.text()

  const serialized = html.match(/<script[^>]+id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]
  if (serialized) {
    try {
      const editorial = pickEditorialArtwork(JSON.parse(serialized))
      if (editorial) return { image: editorial, source: 'apple', kind: 'editorial' }
    } catch {
      // Apple changed the page payload; the og:image below still works.
    }
  }

  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
  const image = ogImage ? appleArtworkUrl(ogImage) : null
  return image ? { image, source: 'apple', kind: 'portrait' } : null
}

const findOnDeezer = async (name: string, fetcher: Fetcher): Promise<ArtistImage | null> => {
  const response = await fetchWithTimeout(fetcher, `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`)
  if (!response.ok) return null
  const payload = (await response.json()) as { data?: Array<{ name?: string; picture_xl?: string }> }
  const artist = pickByName(payload.data ?? [], name, (item) => item.name)
  const image = artist?.picture_xl
  // Deezer serves a blank silhouette at /images/artist//... for artists without a photo.
  if (!image?.startsWith('https://') || image.includes('/images/artist//')) return null
  return { image, source: 'deezer', kind: 'portrait' }
}

export const findArtistImage = async (rawName: string, fetcher: Fetcher = fetch): Promise<ArtistImage | null> => {
  const name = rawName.trim()
  const key = normalizeName(name)
  if (!key) return null

  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  let value: ArtistImage | null = null
  for (const source of [findOnApple, findOnDeezer]) {
    try {
      value = await source(name, fetcher)
    } catch (error) {
      console.warn('[artist-image] source failed', { name, error: error instanceof Error ? error.message : String(error) })
    }
    if (value) break
  }

  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  return value
}
