import { Elysia, t } from 'elysia'

import { findArtistImage } from '../services/artistImages'

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
