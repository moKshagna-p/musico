import { Elysia, t } from 'elysia'

import { findArtistImage, findArtistLogo } from '../services/artistImages'

export const artistRoutes = new Elysia({ prefix: '/api' })
  .get('/artist-image', async ({ query, set }) => {
    const result = await findArtistImage(query.name)
    set.headers ??= {}
    // Misses are cached briefly so a newly added Apple photo shows up within the day.
    set.headers['Cache-Control'] = result
      ? 'public, max-age=86400, s-maxage=604800'
      : 'public, max-age=3600, s-maxage=21600'
    return {
      image: result?.image ?? null,
      source: result?.source ?? null,
      kind: result?.kind ?? null,
      video: result?.video ?? null,
    }
  }, {
    query: t.Object({ name: t.String({ minLength: 1, maxLength: 200 }) }),
  })
  .get('/artist-logo', async ({ query, set }) => {
    // A throw means TheAudioDB was resting and fanart.tv had nothing: answer "none" for now without caching it.
    const logo = await findArtistLogo(query.name).catch(() => undefined)
    set.headers ??= {}
    set.headers['Cache-Control'] = logo
      ? 'public, max-age=86400, s-maxage=604800'
      : logo === null ? 'public, max-age=3600, s-maxage=21600' : 'no-store'
    return { logo: logo ?? null }
  }, {
    query: t.Object({ name: t.String({ minLength: 1, maxLength: 200 }) }),
  })
  // The logo's bytes from our origin: TheAudioDB sends no CORS headers, and the web app reads the pixels to recolor them.
  .get('/artist-logo/image', async ({ query, set }) => {
    const logo = await findArtistLogo(query.name).catch(() => null)
    const upstream = logo ? await fetch(logo, { signal: AbortSignal.timeout(8000) }).catch(() => null) : null
    set.headers ??= {}
    if (!upstream?.ok) {
      set.status = 404
      set.headers['Cache-Control'] = 'no-store'
      return { error: 'No logo for this artist.' }
    }
    set.headers['Content-Type'] = upstream.headers.get('Content-Type') ?? 'image/png'
    set.headers['Cache-Control'] = 'public, max-age=604800, s-maxage=2592000'
    return upstream.arrayBuffer()
  }, {
    query: t.Object({ name: t.String({ minLength: 1, maxLength: 200 }) }),
  })
