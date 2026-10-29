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
      square: result?.square ?? null,
    }
  }, {
    query: t.Object({ name: t.String({ minLength: 1, maxLength: 200 }) }),
  })
  .get('/artist-logo', async ({ query, set }) => {
    set.headers ??= {}
    try {
      const logo = await findArtistLogo(query.name)
      set.headers['Cache-Control'] = logo ? 'public, max-age=86400, s-maxage=604800' : 'public, max-age=3600, s-maxage=21600'
      return { logo }
    } catch (error) {
      // A source failed and nothing else had a logo; the page shows the plain name and asks again later.
      console.warn('[artist-logo] lookup failed', query.name, error instanceof Error ? error.message : String(error))
      set.status = 503
      set.headers['Cache-Control'] = 'no-store'
      return { error: 'Artist logo sources are unavailable right now.' }
    }
  }, {
    query: t.Object({ name: t.String({ minLength: 1, maxLength: 200 }) }),
  })
  // The logo's bytes from our origin: TheAudioDB sends no CORS headers, and the web app reads the pixels to recolor them.
  .get('/artist-logo/image', async ({ query, set }) => {
    set.headers ??= {}
    set.headers['Cache-Control'] = 'no-store'
    const fail = (status: number, message: string, error: unknown) => {
      console.warn('[artist-logo] image failed', query.name, error instanceof Error ? error.message : String(error))
      set.status = status
      return { error: message }
    }
    let logo: string | null
    try {
      logo = await findArtistLogo(query.name)
    } catch (error) {
      return fail(503, 'Artist logo sources are unavailable right now.', error)
    }
    if (!logo) {
      set.status = 404
      return { error: 'No logo for this artist.' }
    }
    let upstream: Response
    try {
      upstream = await fetch(logo, { signal: AbortSignal.timeout(8000) })
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError'
      return fail(timedOut ? 504 : 502, 'The logo host did not answer.', error)
    }
    if (!upstream.ok) return fail(502, 'The logo host could not serve the logo.', `${new URL(logo).host} returned ${upstream.status}`)
    set.headers['Content-Type'] = upstream.headers.get('Content-Type') ?? 'image/png'
    set.headers['Cache-Control'] = 'public, max-age=604800, s-maxage=2592000'
    return upstream.arrayBuffer()
  }, {
    query: t.Object({ name: t.String({ minLength: 1, maxLength: 200 }) }),
  })
