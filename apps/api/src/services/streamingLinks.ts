// Direct album pages on streaming services, from the URL relationships MusicBrainz keeps on each release.
// Spotify and Apple Music are listed for most albums; YouTube Music and Amazon Music less often. The web app keeps its
// search links for anything missing here.

import { artistMatches, cleanDiscogsArtist, normalizeTitle } from './albumArtwork'
import { normalizeName } from './artistImages'
import { bareArtist, mbJson } from './discLabels'

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>
type MbReleaseGroup = { id?: string; title?: string; 'primary-type'?: string; 'artist-credit'?: Array<{ name?: string }> }
type MbRelease = { relations?: Array<{ url?: { resource?: string } }> }

export type StreamingLinks = Partial<Record<'spotify' | 'appleMusic' | 'youtubeMusic' | 'amazonMusic', string>>

// Only album pages count: no artist pages, track links, merch shops or store listings.
const PLATFORMS: Array<[keyof StreamingLinks, RegExp]> = [
  ['spotify', /^https:\/\/open\.spotify\.com\/album\/[A-Za-z0-9]+$/],
  ['appleMusic', /^https:\/\/(music|itunes)\.apple\.com\/[a-z]{2}\/album\/([^/?#]+\/)?(id)?\d+$/],
  // YouTube's auto-generated album playlists (OLAK5uy_) open in YouTube Music as the album.
  ['youtubeMusic', /^https:\/\/(music|www)\.youtube\.com\/playlist\?list=OLAK5uy_[\w-]+$/],
  ['amazonMusic', /^https:\/\/music\.amazon\.[a-z.]+\/albums\/[A-Z0-9]+$/],
]

const CACHE_TTL_MS = 1000 * 60 * 60 * 24
const CACHE_MAX_ENTRIES = 2000
// ponytail: per-isolate memory cache plus the route's edge Cache-Control; move to Postgres if MusicBrainz load shows up.
const cache = new Map<string, { links: StreamingLinks; expiresAt: number }>()

// Apple links lose their country (/gb/, /nz/), so Apple sends each visitor to their own storefront.
const tidy = (platform: keyof StreamingLinks, url: string) => {
  if (platform === 'appleMusic') return `https://music.apple.com/album/${url.match(/\/(?:id)?(\d+)$/)?.[1]}`
  if (platform === 'youtubeMusic') return url.replace('://www.', '://music.')
  return url
}

export const pickStreamingLinks = (urls: string[]): StreamingLinks => {
  const links: StreamingLinks = {}
  for (const url of urls) {
    const platform = PLATFORMS.find(([key, pattern]) => !links[key] && pattern.test(url))?.[0]
    if (platform) links[platform] = tidy(platform, url)
  }
  return links
}

export const findStreamingLinks = async (artist: string, album: string, fetcher: Fetcher = fetch): Promise<StreamingLinks> => {
  const targetArtist = normalizeName(bareArtist(cleanDiscogsArtist(artist)))
  const targetAlbum = normalizeTitle(album)
  if (!targetArtist || !targetAlbum) return {}

  const key = `${targetArtist}\u0000${targetAlbum}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.links

  // Normalized names hold only letters, numbers and spaces, so they are safe inside Lucene phrases.
  const query = `releasegroup:"${targetAlbum}" AND artist:"${targetArtist}"`
  const search = await mbJson(`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=25`, fetcher)
  const groups: MbReleaseGroup[] = Array.isArray(search?.['release-groups']) ? search['release-groups'] : []
  const matches = groups.filter((group) =>
    normalizeTitle(group.title ?? '') === targetAlbum &&
    artistMatches(bareArtist(group['artist-credit']?.[0]?.name ?? ''), targetArtist))
  // The album before a same-titled single.
  const group = matches.find((entry) => entry['primary-type'] === 'Album') ?? matches[0]

  let links: StreamingLinks = {}
  if (group?.id) {
    const browse = await mbJson(`https://musicbrainz.org/ws/2/release?release-group=${group.id}&inc=url-rels&fmt=json&limit=100`, fetcher)
    const releases: MbRelease[] = Array.isArray(browse?.releases) ? browse.releases : []
    links = pickStreamingLinks(releases.flatMap((release) => (release.relations ?? []).map((relation) => String(relation.url?.resource ?? ''))))
  }

  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(key, { links, expiresAt: Date.now() + CACHE_TTL_MS })
  return links
}
