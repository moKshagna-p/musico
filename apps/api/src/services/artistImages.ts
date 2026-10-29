// Artist photos for album heroes. Apple Music has the best editorial shots and
// motion heroes but no public image API, so we read the artist's public page.
// fanart.tv (with an API key) fills in wide backgrounds, and Deezer's open API
// is the last resort. Artist logos come from TheAudioDB, then fanart.tv.

import { env } from '../core/env'
import { isServicePaused, pauseService, sharedGet, sharedSet } from '../core/sharedCache'
import { mbJson } from './musicbrainz'
import { audioDbJson } from './theAudioDb'

// `editorial` art is a wide, art-directed hero; `portrait` is a plain artist photo.
// `video` is Apple's looping HLS motion hero, when the artist has one.
// `square` is Apple's square cut of the same hero, art-directed for phones.
type HeroArt = { image: string; video: string | null }
export type ArtistImage = HeroArt & {
  source: 'apple' | 'fanart' | 'deezer'
  kind: 'editorial' | 'portrait'
  square: HeroArt | null
}

export class ArtistImageUnavailableError extends Error {
  constructor(readonly fallback: ArtistImage | null) {
    super('Artist image sources are unavailable right now.')
  }
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

const CACHE_TTL_MS = 1000 * 60 * 60 * 24
const CACHE_MAX_ENTRIES = 2000
const REQUEST_TIMEOUT_MS = 4000
const RATE_LIMIT_BACKOFF_MS = 1000 * 60 * 10
let appleBackoffUntil = 0
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// Memory first, then the Postgres cache every isolate shares, then the sources.
type Cache<T> = Map<string, { value: T; expiresAt: number }>
const imageCache: Cache<ArtistImage | null> = new Map()
const logoCache: Cache<string | null> = new Map()

const remember = async <T>(cache: Cache<T>, key: string, load: () => Promise<T>) => {
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const stored = await sharedGet<T>(key)
  const value = stored ? stored.value : await load()
  if (!stored) await sharedSet(key, value, CACHE_TTL_MS)
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  return value
}

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
const resolveAppleTemplate = (artwork: AppleArtwork | undefined, maxWidth = 2400) => {
  const url = typeof artwork?.url === 'string' ? artwork.url : ''
  const width = Number(artwork?.width)
  const height = Number(artwork?.height)
  if (!MZSTATIC_TEMPLATE.test(url) || !(width > 0) || !(height > 0)) return null
  const outWidth = Math.min(maxWidth, width)
  const outHeight = Math.round((outWidth * height) / width)
  return url.replace('{w}x{h}{c}.{f}', `${outWidth}x${outHeight}bb.webp`)
}

const APPLE_MOTION_VIDEO = /^https:\/\/mvod\.itunes\.apple\.com\/itunes-assets\/.+\.m3u8$/i

const readMotion = (value: unknown, maxWidth?: number) => {
  const { previewFrame, video } = value as { previewFrame?: AppleArtwork; video?: unknown }
  return {
    image: resolveAppleTemplate(previewFrame, maxWidth),
    video: typeof video === 'string' && APPLE_MOTION_VIDEO.test(video) ? video : null,
  }
}

const firstResolved = (arts: Array<{ image: string | null; video: string | null }>) =>
  arts.find((art): art is HeroArt => Boolean(art.image)) ?? null

// Prefers art-directed heroes: motion heroes (still plus video), then editorial banners.
export const pickEditorialArtwork = (pageData: unknown) => {
  const motions = findAllByKey(pageData, 'motionArtistFullscreen16x9').map((value) => readMotion(value))
  const banners = findAllByKey(pageData, 'wideArtwork')
    .map((value) => (value as { dictionary?: AppleArtwork }).dictionary)
    .filter((artwork) => typeof artwork?.url === 'string' && /\/thumb\/Features/i.test(artwork.url))
    .map((artwork) => ({ image: resolveAppleTemplate(artwork), video: null }))

  const wide = firstResolved([...motions, ...banners])
  if (!wide) return null
  // 1400px covers a phone's full width at 3x.
  const square = firstResolved(findAllByKey(pageData, 'motionArtistSquare1x1').map((value) => readMotion(value, 1400)))
  return { ...wide, square }
}

export const appleArtworkUrl = (ogImage: string, size = 1800) => {
  // Only real artist photos; other og:images are album art or Apple placeholders.
  if (!/^https:\/\/[a-z0-9-]+\.mzstatic\.com\/image\/thumb\/AMCArtistImages/i.test(ogImage)) return null
  return ogImage.replace(/\/\d+x\d+[a-z]*\.(?:png|jpe?g|webp)$/i, `/${size}x${size}bb.webp`)
}

type AppleArt = { wide: ArtistImage | null; portrait: ArtistImage | null }

const readServerData = (html: string) => html.match(/<script[^>]+id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]

// One search result, e.g. { kind: 'album', title: 'Take Care', artist: 'Drake', ... }.
type AppleSearchItem = { kind: string; title: string; artist: string; url: string; artwork?: AppleArtwork }

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

const fetchApple = async (url: string, fetcher: Fetcher, timeoutMs = REQUEST_TIMEOUT_MS) => {
  if (Date.now() < appleBackoffUntil || await isServicePaused('apple')) throw new Error('Apple Music is rate limited')
  const response = await fetcher(url, {
    headers: { 'User-Agent': BROWSER_UA },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (response.status === 403 || response.status === 429) {
    appleBackoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS
    await pauseService('apple', RATE_LIMIT_BACKOFF_MS)
  }
  return response
}

// The iTunes Search API rate-limits Cloudflare's shared egress IPs (HTTP 429), so we read Apple Music's own search page.
export const searchAppleMusic = async (term: string, fetcher: Fetcher, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const response = await fetchApple(`https://music.apple.com/us/search?term=${encodeURIComponent(term)}`, fetcher, timeoutMs)
  if (!response.ok) throw Object.assign(new Error(`Apple Music search failed (${response.status})`), { status: response.status })
  const serialized = readServerData(await response.text())
  if (!serialized) throw new Error('Apple Music search page has no server data')
  return collectSearchItems(JSON.parse(serialized))
}

const findOnApple = async (name: string, fetcher: Fetcher): Promise<AppleArt | null> => {
  const artists = (await searchAppleMusic(name, fetcher)).filter((item) => item.kind === 'artist')
  const pageUrl = pickByName(artists, name, (item) => item.title)?.url.split('?')[0]
  if (!pageUrl?.startsWith('https://music.apple.com/')) return null

  const pageResponse = await fetchApple(pageUrl, fetcher)
  if (!pageResponse.ok) throw new Error(`Apple Music artist page failed (${pageResponse.status})`)
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
  return { wide, portrait: image ? { image, source: 'apple', kind: 'portrait', video: null, square: null } : null }
}

const MBID = /^[0-9a-f-]{36}$/i

const findArtistMbid = async (name: string, fetcher: Fetcher) => {
  const query = encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`)
  const search = await mbJson(`https://musicbrainz.org/ws/2/artist/?query=${query}&fmt=json&limit=5`, fetcher, REQUEST_TIMEOUT_MS)
  const { artists = [] } = (search ?? {}) as { artists?: Array<{ id?: string; name?: string }> }
  const mbid = pickByName(artists, name, (item) => item.name)?.id
  return mbid && MBID.test(mbid) ? mbid : null
}

type FanartImage = { url?: string; likes?: string }
type FanartArtist = Partial<Record<'artistbackground' | 'hdmusiclogo' | 'musiclogo', FanartImage[]>>

// fanart.tv keys artists by MusicBrainz id.
const getFanartArtist = async (mbid: string, fetcher: Fetcher, apiKey: string) => {
  const response = await fetchWithTimeout(fetcher, `https://webservice.fanart.tv/v3/music/${mbid}?api_key=${encodeURIComponent(apiKey)}`)
  // 404 means fanart.tv has no art for the artist; anything else is a failure, not a miss.
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`fanart.tv returned ${response.status}`)
  return (await response.json()) as FanartArtist
}

const mostLiked = (images: FanartImage[] = []) =>
  [...images]
    .sort((a, b) => Number(b.likes ?? 0) - Number(a.likes ?? 0))
    .map((image) => String(image.url ?? '').replace(/^http:\/\//, 'https://'))
    .find((candidate) => candidate.startsWith('https://assets.fanart.tv/')) ?? null

// fanart.tv has 1920x1080 backgrounds for many smaller artists.
const findOnFanart = async (name: string, fetcher: Fetcher, apiKey?: string): Promise<ArtistImage | null> => {
  if (!apiKey) return null
  const mbid = await findArtistMbid(name, fetcher)
  const url = mbid ? mostLiked((await getFanartArtist(mbid, fetcher, apiKey))?.artistbackground) : null
  return url ? { image: url, source: 'fanart', kind: 'editorial', video: null, square: null } : null
}

const findOnDeezer = async (name: string, fetcher: Fetcher): Promise<ArtistImage | null> => {
  const response = await fetchWithTimeout(fetcher, `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`)
  if (!response.ok) throw new Error(`Deezer returned ${response.status}`)
  const payload = (await response.json()) as { data?: Array<{ name?: string; picture_xl?: string }> }
  const artist = pickByName(payload.data ?? [], name, (item) => item.name)
  const image = artist?.picture_xl
  // Deezer serves a blank silhouette at /images/artist//... for artists without a photo.
  if (!image?.startsWith('https://') || image.includes('/images/artist//')) return null
  return { image, source: 'deezer', kind: 'portrait', video: null, square: null }
}

export const findArtistImage = async (
  rawName: string,
  fetcher: Fetcher = fetch,
  fanartKey: string | undefined = env.FANART_API_KEY,
): Promise<ArtistImage | null> => {
  const name = rawName.trim()
  const key = normalizeName(name)
  if (!key) return null

  return remember(imageCache, `artist-image:${key}`, async () => {
    let failed = false
    const attempt = async <T>(source: string, lookup: () => Promise<T | null>) => {
      try {
        return await lookup()
      } catch (error) {
        failed = true
        console.warn('[artist-image] source failed', { source, name, error: error instanceof Error ? error.message : String(error) })
        return null
      }
    }
    // Wide art beats a square photo, whichever source it comes from.
    const apple = await attempt('apple', () => findOnApple(name, fetcher))
    const image = apple?.wide ??
      (await attempt('fanart', () => findOnFanart(name, fetcher, fanartKey))) ??
      apple?.portrait ??
      (await attempt('deezer', () => findOnDeezer(name, fetcher)))
    // A transient failure must not save a miss or lower-priority artwork for a day.
    if (failed) throw new ArtistImageUnavailableError(image)
    return image
  })
}

type AudioDbArtist = { strArtist?: string; strArtistLogo?: string | null; strArtistMBID?: string | null }

// A transparent PNG of the artist's wordmark (about 800x310). fanart.tv's HD logos are preferred over its old 400x155 ones.
export const findArtistLogo = async (
  rawName: string,
  fetcher: Fetcher = fetch,
  keys: { audioDb: string; fanart?: string } = { audioDb: env.THEAUDIODB_API_KEY, fanart: env.FANART_API_KEY },
): Promise<string | null> => {
  const name = rawName.trim()
  const key = normalizeName(name)
  if (!key) return null

  return remember(logoCache, `artist-logo:${key}`, async () => {
    let audioDbFailed = false
    const artist = await audioDbJson(`search.php?s=${encodeURIComponent(name)}`, keys.audioDb, fetcher)
      .then(({ artists }: { artists?: AudioDbArtist[] | null }) => pickByName(artists ?? [], name, (item) => item.strArtist) ?? null)
      .catch((error) => {
        audioDbFailed = true
        console.warn('[artist-logo] theaudiodb failed', { name, error: error instanceof Error ? error.message : String(error) })
        return null
      })
    const logo = String(artist?.strArtistLogo ?? '').replace(/^http:\/\//, 'https://')
    if (/^https:\/\/(r2|www)\.theaudiodb\.com\/images\/media\/artist\/logo\//i.test(logo)) return logo

    let fanartFailed = false
    let fanartLogo: string | null = null
    if (keys.fanart) {
      try {
        const mbid = artist?.strArtistMBID && MBID.test(artist.strArtistMBID) ? artist.strArtistMBID : await findArtistMbid(name, fetcher)
        const fanart = mbid ? await getFanartArtist(mbid, fetcher, keys.fanart) : null
        fanartLogo = mostLiked(fanart?.hdmusiclogo) ?? mostLiked(fanart?.musiclogo)
      } catch (error) {
        fanartFailed = true
        console.warn('[artist-logo] fanart failed', { name, error: error instanceof Error ? error.message : String(error) })
      }
    }
    // Throwing skips the cache, so a logo a failing source couldn't serve is looked up again next time.
    if (!fanartLogo && (audioDbFailed || fanartFailed)) throw new Error('A logo source failed and no logo was found')
    return fanartLogo
  })
}
