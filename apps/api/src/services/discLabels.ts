// Art for the disc's center. MusicBrainz finds the album's vinyl pressings and the Cover Art Archive holds photos
// tagged "Medium" (the disc itself), which are mostly tight label shots. Albums without one fall back to fan-made
// CD faces from TheAudioDB, then fanart.tv; their URLs contain "/cdart/", which the web app crops differently.
// Like HD covers, every answer (including "no photo") is kept in Postgres so each album is looked up once.

import { inArray, sql } from 'drizzle-orm'

import { db } from '../core/db'
import { env } from '../core/env'
import { albumDiscLabel } from '../core/schema'
import { artistMatches, cleanDiscogsArtist, normalizeTitle } from './albumArtwork'
import { normalizeName } from './artistImages'
import { audioDbJson } from './theAudioDb'

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>
type LabelRow = { albumId: string; label: string | null; checkedAt: Date }
type AlbumLike = { id: string; name: string; artists: string[] }
type MbRelease = {
  id: string
  date?: string
  media?: Array<{ format?: string }>
  'artist-credit'?: Array<{ name?: string }>
  'release-group'?: { id?: string; title?: string; 'primary-type'?: string }
}
type CaaImage = { types?: string[]; image?: string; thumbnails?: Record<string, string> }
type AudioDbAlbum = { strAlbum?: string; strArtist?: string; strAlbumCDart?: string | null; strMusicBrainzID?: string | null }
type FanartImage = { url?: string; likes?: string }
type ArtKeys = { audioDb: string; fanart?: string }

export type DiscLabelStore = {
  read: (albumIds: string[]) => Promise<LabelRow[]>
  write: (rows: LabelRow[]) => Promise<unknown>
}

// The Cover Art Archive redirects to archive.org, which often takes 4-8s; lookups never block a page.
const LOOKUP_TIMEOUT_MS = 15000
const MAX_PRESSINGS = 4
const RECHECK_MISS_MS = 1000 * 60 * 60 * 24 * 30
// ponytail: misses recorded before the CD art sources existed are rechecked once; drop after 2026-12-01.
const CD_ART_ADDED_AT = Date.parse('2026-10-29T00:00:00Z')
const RATE_LIMIT_BACKOFF_MS = 1000 * 60 * 10
// MusicBrainz allows one request per second per client.
const MB_GAP_MS = 1100

// ponytail: per-isolate throttle and backoff; isolates sharing an IP can still trip MusicBrainz's limit together.
let nextMbSlot = 0
let mbBackoffUntil = 0
const waitForMbSlot = async () => {
  const wait = nextMbSlot - Date.now()
  nextMbSlot = Math.max(Date.now(), nextMbSlot) + MB_GAP_MS
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
}

const getJson = async (url: string, fetcher: Fetcher) => {
  const response = await fetcher(url, {
    headers: { 'User-Agent': env.DISCOGS_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  })
  if (response.status === 404) return null
  if (!response.ok) throw Object.assign(new Error(`${new URL(url).host} returned ${response.status}`), { status: response.status })
  return response.json()
}

// One MusicBrainz request in the shared one-per-second slot. It answers 503 whenever its servers are busy, so one retry
// in the next slot is normal.
export const mbJson = async (url: string, fetcher: Fetcher) => {
  const request = async () => {
    await waitForMbSlot()
    return getJson(url, fetcher)
  }
  return request().catch((error) => {
    if ((error as { status?: number }).status === 503) return request()
    throw error
  })
}

// Discogs and MusicBrainz disagree on a leading "The" ("The Bill Evans Trio" vs "Bill Evans Trio").
export const bareArtist = (name: string) => name.replace(/^\s*the\s+/i, '')

// Only URLs on the expected image hosts reach the page.
const safeUrl = (url: string | null | undefined, host: RegExp) => {
  const https = String(url ?? '').replace(/^http:/, 'https:')
  return host.test(https) ? https : null
}

// Only a photo tagged solely "Medium" is the disc; "Front,Medium" is a cover shot with the record beside it.
const pickLabel = (images: CaaImage[] = []) => {
  const disc = images.find((image) => image.types?.length === 1 && image.types[0] === 'Medium')
  return safeUrl(disc?.thumbnails?.['500'] ?? disc?.thumbnails?.large ?? disc?.image, /^https:\/\/(coverartarchive\.org|[a-z0-9.-]+\.archive\.org)\//i)
}

// Fan-made CD faces: transparent, square PNGs of the whole disc. TheAudioDB first, then fanart.tv by release group.
const findCdArt = async (artist: string, album: string, releaseGroupId: string | undefined, keys: ArtKeys, fetcher: Fetcher) => {
  let audioDbError: unknown = null
  const search = await audioDbJson(`searchalbum.php?s=${encodeURIComponent(artist)}&a=${encodeURIComponent(album)}`, keys.audioDb, fetcher)
    .catch((error) => { audioDbError = error; return null })
  const albums: AudioDbAlbum[] = Array.isArray(search?.album) ? search.album : []
  const match = albums.find((entry) =>
    normalizeTitle(entry.strAlbum ?? '') === normalizeTitle(album) &&
    artistMatches(bareArtist(entry.strArtist ?? ''), normalizeName(bareArtist(artist))))
  const audioDbArt = safeUrl(match?.strAlbumCDart, /^https:\/\/(r2|www)\.theaudiodb\.com\/images\/media\/album\/cdart\//i)
  if (audioDbArt) return audioDbArt

  const groupId = releaseGroupId ?? match?.strMusicBrainzID ?? undefined
  let fanartError: unknown = null
  const fanart = keys.fanart && groupId && /^[0-9a-f-]{36}$/i.test(groupId)
    ? await getJson(`https://webservice.fanart.tv/v3/music/albums/${groupId}?api_key=${encodeURIComponent(keys.fanart)}`, fetcher)
      .catch((error) => { fanartError = error; return null })
    : null
  const cdart: FanartImage[] = fanart?.albums?.[groupId ?? '']?.cdart ?? []
  const fanartArt = [...cdart]
    .sort((a, b) => Number(b.likes ?? 0) - Number(a.likes ?? 0))
    .map((image) => safeUrl(image.url, /^https:\/\/assets\.fanart\.tv\/fanart\/music\/.+\/cdart\//i))
    .find(Boolean) ?? null
  // A failing source might hold art once it answers again, so retry the album later rather than record a miss.
  // Thrown without a status: TheAudioDB's and fanart.tv's limits are their own and must not pause MusicBrainz lookups.
  const sourceError = audioDbError ?? fanartError
  if (!fanartArt && sourceError) throw new Error(sourceError instanceof Error ? sourceError.message : String(sourceError))
  return fanartArt
}

export const findDiscLabel = async (
  artist: string,
  album: string,
  fetcher: Fetcher = fetch,
  keys: ArtKeys = { audioDb: env.THEAUDIODB_API_KEY, fanart: env.FANART_API_KEY },
) => {
  const targetArtist = normalizeName(bareArtist(artist))
  const targetAlbum = normalizeTitle(album)
  if (!targetArtist || !targetAlbum) return null

  // Normalized names hold only letters, numbers and spaces, so they are safe inside Lucene phrases.
  const query = `releasegroup:"${targetAlbum}" AND artist:"${targetArtist}"`
  const search = await mbJson(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=100`, fetcher)
  const releases: MbRelease[] = Array.isArray(search?.releases) ? search.releases : []

  const matches = releases.filter((release) =>
    normalizeTitle(release['release-group']?.title ?? '') === targetAlbum &&
    artistMatches(bareArtist(release['artist-credit']?.[0]?.name ?? ''), targetArtist))
  // Albums before same-titled singles, then the oldest pressing: original labels are the iconic ones.
  const pressings = matches
    .filter((release) => release.media?.some((medium) => /vinyl/i.test(medium.format ?? '')))
    .sort((a, b) =>
      Number(b['release-group']?.['primary-type'] === 'Album') - Number(a['release-group']?.['primary-type'] === 'Album') ||
      (a.date || '9999').localeCompare(b.date || '9999'))
    .slice(0, MAX_PRESSINGS)

  // The Cover Art Archive is not rate limited like MusicBrainz, so check the pressings together.
  const art = await Promise.allSettled(pressings.map((release) => getJson(`https://coverartarchive.org/release/${release.id}`, fetcher)))
  for (const entry of art) {
    const label = entry.status === 'fulfilled' ? pickLabel(entry.value?.images) : null
    if (label) return label
  }
  // A failed pressing might hold the photo, so throw rather than save CD art or a miss; the album is retried later.
  const failed = art.find((entry) => entry.status === 'rejected')
  if (failed) throw failed.reason
  const albumGroup = matches.find((release) => release['release-group']?.['primary-type'] === 'Album') ?? matches[0]
  return findCdArt(artist, album, albumGroup?.['release-group']?.id, keys, fetcher)
}

const dbStore: DiscLabelStore = {
  read: (albumIds) => db.select().from(albumDiscLabel).where(inArray(albumDiscLabel.albumId, albumIds)),
  write: (rows) =>
    db
      .insert(albumDiscLabel)
      .values(rows)
      .onConflictDoUpdate({
        target: albumDiscLabel.albumId,
        set: { label: sql`excluded."label"`, checkedAt: sql`excluded."checkedAt"` },
      }),
}

// Adds `discLabel` where a label photo is known, looking up at most `maxLookups` new albums one after another.
export const attachDiscLabels = async <T extends AlbumLike>(
  releases: T[],
  { maxLookups = 0, store = dbStore, fetcher = fetch }: { maxLookups?: number; store?: DiscLabelStore; fetcher?: Fetcher } = {},
): Promise<Array<T & { discLabel?: string }>> => {
  const albumIds = [...new Set(releases.map((release) => release.id).filter(Boolean))]
  if (!albumIds.length) return releases

  let known: Map<string, LabelRow>
  try {
    known = new Map((await store.read(albumIds)).map((row) => [row.albumId, row]))
  } catch (error) {
    // Labels are cosmetic: the disc keeps its plain style if the table is missing or the read fails.
    console.warn('[disc-label] read failed', error instanceof Error ? error.message : String(error))
    return releases
  }

  const now = Date.now()
  const needsLookup = (release: T) => {
    const row = known.get(release.id)
    const checkedAt = row?.checkedAt.getTime() ?? 0
    return Boolean(release.artists?.[0] && release.name) && (!row || (!row.label && (now - checkedAt > RECHECK_MISS_MS || checkedAt < CD_ART_ADDED_AT)))
  }
  const pending = now < mbBackoffUntil
    ? []
    : [...new Map(releases.filter(needsLookup).map((release) => [release.id, release])).values()].slice(0, maxLookups)

  const fresh: LabelRow[] = []
  for (const release of pending) {
    try {
      const label = await findDiscLabel(cleanDiscogsArtist(release.artists[0]), release.name, fetcher)
      fresh.push({ albumId: release.id, label, checkedAt: new Date() })
    } catch (error) {
      // Failed lookups are not recorded, so the album is retried on a later request.
      console.warn('[disc-label] lookup failed', release.id, error instanceof Error ? error.message : String(error))
      const status = (error as { status?: number }).status
      if (status === 429 || status === 503) {
        mbBackoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS
        break
      }
    }
  }
  if (fresh.length) {
    fresh.forEach((row) => known.set(row.albumId, row))
    await store.write(fresh).catch((error) => {
      console.warn('[disc-label] write failed', error instanceof Error ? error.message : String(error))
    })
  }

  return releases.map((release) => {
    const label = known.get(release.id)?.label
    return label ? { ...release, discLabel: label } : release
  })
}

// Adds no latency: the page shows the plain disc now and the real label from the next visit.
export const lookUpDiscLabelsLater = (releases: AlbumLike[], maxLookups = 1) => {
  const work = attachDiscLabels(releases, { maxLookups })
  // Workers cancel work once the response is sent unless it is handed to waitUntil; Bun just keeps running it.
  import('cloudflare:workers').then(({ waitUntil }) => waitUntil(work)).catch(() => {})
}
