// Official album covers from Apple Music, which are cleaner than Discogs scans. Lookups happen on demand,
// a few per request, and every answer (including "Apple has no match") is kept
// in Postgres so each album is only looked up once.

import { inArray, sql } from 'drizzle-orm'

import { db } from '../core/db'
import { albumArtwork } from '../core/schema'
import { isServicePaused } from '../core/sharedCache'
import { normalizeName, searchAppleMusic } from './artistImages'

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>
type ArtworkRow = { albumId: string; cover: string | null; checkedAt: Date }
type AlbumLike = { id: string; name: string; artists: string[]; cover: string }

export type ArtworkStore = {
  read: (albumIds: string[]) => Promise<ArtworkRow[]>
  write: (rows: ArtworkRow[]) => Promise<unknown>
}

// Cards and the album hero render at most ~520 device px; 1200px covers were ~500KB each, 600px ~135KB.
const COVER_SIZE = 600
// Apple encodes the size in the URL, so covers stored at an older size are resized on the way out.
const toCoverSize = (url: string) => url.replace(/\/\d+x\d+bb\.jpg$/, `/${COVER_SIZE}x${COVER_SIZE}bb.jpg`)
// Apple renders uncached search pages in 2-3s; each album is looked up once and the answer stored.
const LOOKUP_TIMEOUT_MS = 5000
const RECHECK_MISS_MS = 1000 * 60 * 60 * 24 * 30

// Discogs disambiguates artists as "Name (2)" and marks name variations with "*".
export const cleanDiscogsArtist = (name = '') => name.replace(/\s*\(\d+\)$/, '').replace(/\*$/, '').trim()

// Apple appends edition notes ("(Deluxe Version)", " - Single") that Discogs titles lack.
export const normalizeTitle = (value: string) =>
  normalizeName(value.replace(/\s*[([][^)\]]*[)\]]/g, '').replace(/\s+-\s+(single|ep)$/i, ''))

// Accepts the exact artist or a collaboration led by them ("Drake & Future"), not look-alikes ("Drake Tribute").
export const artistMatches = (candidate: string, target: string) =>
  normalizeName(candidate) === target || normalizeName(candidate.split(/\s*(?:&|,|\bfeat\.?|\bft\.?|\bwith\b)\s*/i)[0]) === target

export const findAppleAlbumCover = async (artist: string, album: string, fetcher: Fetcher = fetch) => {
  const targetArtist = normalizeName(artist)
  const targetAlbum = normalizeTitle(album)
  if (!targetArtist || !targetAlbum) return null

  const items = await searchAppleMusic(`${artist} ${album}`, fetcher, LOOKUP_TIMEOUT_MS)
  const match = items.find(
    (item) => item.kind === 'album' && artistMatches(item.artist, targetArtist) && normalizeTitle(item.title) === targetAlbum,
  )
  const artwork = typeof match?.artwork?.url === 'string' ? match.artwork.url : ''
  if (!/^https:\/\/[a-z0-9-]+\.mzstatic\.com\/image\/thumb\/.+\/\{w\}x\{h\}[a-z]*\.\{f\}$/i.test(artwork)) return null
  return artwork.replace(/\{w\}x\{h\}[a-z]*\.\{f\}$/i, `${COVER_SIZE}x${COVER_SIZE}bb.jpg`)
}

const dbStore: ArtworkStore = {
  read: (albumIds) => db.select().from(albumArtwork).where(inArray(albumArtwork.albumId, albumIds)),
  write: (rows) =>
    db
      .insert(albumArtwork)
      .values(rows)
      .onConflictDoUpdate({
        target: albumArtwork.albumId,
        set: { cover: sql`excluded."cover"`, checkedAt: sql`excluded."checkedAt"` },
      }),
}

// Swaps in Apple's high-resolution cover where one is known, looking up at most `maxLookups` new albums.
export const attachHdCovers = async <T extends AlbumLike>(
  releases: T[],
  { maxLookups = 6, store = dbStore, fetcher = fetch }: { maxLookups?: number; store?: ArtworkStore; fetcher?: Fetcher } = {},
): Promise<T[]> => {
  const albumIds = [...new Set(releases.map((release) => release.id).filter(Boolean))]
  if (!albumIds.length) return releases

  let known: Map<string, ArtworkRow>
  try {
    known = new Map((await store.read(albumIds)).map((row) => [row.albumId, row]))
  } catch (error) {
    // Covers are cosmetic: keep serving Discogs art if the table is missing or the read fails.
    console.warn('[album-artwork] read failed', error instanceof Error ? error.message : String(error))
    return releases
  }

  const now = Date.now()
  const needsLookup = (release: T) => {
    const row = known.get(release.id)
    return Boolean(release.artists?.[0] && release.name) && (!row || (!row.cover && now - row.checkedAt.getTime() > RECHECK_MISS_MS))
  }
  const pending = await isServicePaused('apple')
    ? []
    : [...new Map(releases.filter(needsLookup).map((release) => [release.id, release])).values()].slice(0, maxLookups)

  const looked = await Promise.all(
    pending.map(async (release): Promise<ArtworkRow | null> => {
      try {
        const cover = await findAppleAlbumCover(cleanDiscogsArtist(release.artists[0]), release.name, fetcher)
        return { albumId: release.id, cover, checkedAt: new Date() }
      } catch (error) {
        // Failed lookups are not recorded, so the album is retried on a later request.
        console.warn('[album-artwork] lookup failed', release.id, error instanceof Error ? error.message : String(error))
        return null
      }
    }),
  )
  const fresh = looked.filter((row): row is ArtworkRow => row !== null)
  if (fresh.length) {
    fresh.forEach((row) => known.set(row.albumId, row))
    await store.write(fresh).catch((error) => {
      console.warn('[album-artwork] write failed', error instanceof Error ? error.message : String(error))
    })
  }

  return releases.map((release) => {
    const cover = known.get(release.id)?.cover
    return cover ? { ...release, cover: toCoverSize(cover) } : release
  })
}
