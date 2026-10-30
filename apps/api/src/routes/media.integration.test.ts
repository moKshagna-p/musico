import { expect, test } from 'bun:test'

// A separate process keeps the Neon adapter and authentication stubs out of other API tests.
test.skipIf(!process.env.TEST_DATABASE_URL)('media reservations, review saves, cleanup and the shared cache work against real PostgreSQL', async () => {
  const script = String.raw`
    import assert from 'node:assert/strict'
    import { readdir } from 'node:fs/promises'
    import { SQL } from 'bun'
    import { mock } from 'bun:test'
    import { drizzle } from 'drizzle-orm/neon-http'
    import { Elysia } from 'elysia'

    const admin = new SQL(process.env.TEST_DATABASE_URL)
    const name = 'musico_media_' + crypto.randomUUID().replaceAll('-', '')
    await admin.unsafe('create database "' + name + '" template template0 encoding \'UTF8\'')
    const url = new URL(process.env.TEST_DATABASE_URL)
    url.pathname = '/' + name
    const pool = new SQL(url.href)
    try {
      for (const file of (await readdir('./drizzle')).filter(file => file.endsWith('.sql')).sort()) {
        for (const statement of (await Bun.file('./drizzle/' + file).text()).split('--> statement-breakpoint')) {
          if (statement.trim()) await pool.unsafe(statement).simple()
        }
      }
      // Exercise the production Neon HTTP Drizzle driver with real PostgreSQL transactions.
      const run = async (connection, query) => ({ rows: query.options.arrayMode
        ? await connection.unsafe(query.text, query.params).values()
        : await connection.unsafe(query.text, query.params) })
      const client = (text, params, options = {}) => {
        const query = { text, params, options }
        return Object.assign(query, { then: (resolve, reject) => run(pool, query).then(resolve, reject) })
      }
      client.transaction = queries => pool.begin(async connection => {
        const results = []
        for (const query of queries) results.push(await run(connection, query))
        return results
      })
      const db = drizzle(client)
      mock.module('./src/core/db.ts', () => ({ db }))
      mock.module('./src/core/utils.ts', () => ({
        ensureAuthenticated: async () => ({ id: 'owner' }),
        getCanonicalAlbumMetadata: async () => ({ name: 'Album', cover: '', artists: [], releaseYear: null }),
        recordActivity: async () => {},
        normalizeListName: value => String(value ?? '').trim(),
        getReleasePreviewMap: async () => new Map(),
        isMissingTableError: (error, table) => [error, error?.cause].some(e => e?.message?.includes('relation "' + table + '" does not exist')),
      }))
      const { mediaRoutes } = await import('./src/routes/media.ts')
      const { reviewRoutes } = await import('./src/routes/reviews.ts')
      const { listRoutes } = await import('./src/routes/lists.ts')
      const { sweepDetachedMedia } = await import('./src/core/media.ts')
      const app = new Elysia().onError(({ error }) => { console.error(error); return { error: String(error) } }).use(mediaRoutes).use(reviewRoutes).use(listRoutes)
      const objects = new Set()
      let putHook = async () => {}
      let deleteHook = async () => {}
      globalThis.__MUSICO_WORKER_ENV__ = {
        BETTER_AUTH_URL: 'http://localhost',
        MEDIA: {
          put: async key => { await putHook(); objects.add(key) },
          get: async () => null,
          delete: async keys => { await deleteHook(keys); keys.forEach(key => objects.delete(key)) },
        },
      }
      await pool.unsafe('insert into "user" (id, name, email, "createdAt", "updatedAt") values ($1, $1, $1, now(), now())', ['owner'])
      const png = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
      const upload = async () => {
        const form = new FormData()
        form.set('file', new Blob([png]), 'image.png')
        form.set('width', '10'); form.set('height', '10')
        const response = await app.handle(new Request('http://localhost/api/me/media', { method: 'POST', body: form }))
        return { status: response.status, body: await response.json() }
      }
      const save = async (album, ids, content = 'review') => {
        const response = await app.handle(new Request('http://localhost/api/me/reviews/' + album, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, media: ids.map(id => ({ id, alt: id })) }),
        }))
        return { status: response.status, body: await response.json() }
      }
      const reset = async () => {
        await pool.unsafe('truncate review_media, user_review cascade')
        objects.clear()
        putHook = async () => {}; deleteHook = async () => {}
      }
      const seed = async (id, size = 8, user = 'owner') => pool.unsafe(
        'insert into review_media (id, "userId", kind, key, size, width, height, "createdAt") values ($1, $2, \'image\', $1, $3, 10, 10, now())',
        [id, user, size],
      )
      const gate = () => { let release; const promise = new Promise(resolve => { release = resolve }); return { promise, release } }

      // One remaining daily slot: even while the first object write is held, only one caller reaches R2.
      for (let i = 0; i < 49; i++) await seed('seed-' + i)
      const put = gate(); const entered = gate()
      putHook = async () => { entered.release(); await put.promise }
      const first = upload()
      await entered.promise
      const pending = (await pool.unsafe("select id from review_media where state = 'uploading'"))[0]
      assert.equal((await save('pending', [pending.id])).status, 400)
      const rejected = await upload()
      assert.equal(rejected.status, 429)
      assert.equal((await pool.unsafe('select count(*)::int as count from review_media'))[0].count, 50)
      put.release()
      assert.equal((await first).status, 200)
      await reset()

      // The global byte budget also includes reservations held by another uploader.
      const budget = 9 * 1024 ** 3
      for (let i = 0; i < 9; i++) await seed('budget-' + i, 1024 ** 3 - (i === 0 ? 8 : 0), 'other')
      const byteResults = await Promise.all([upload(), upload()])
      assert.deepEqual(byteResults.map(r => r.status).sort(), [200, 507])
      await reset()

      // Failed writes release capacity; failed object cleanup keeps a retryable reservation.
      putHook = async () => { throw new Error('simulated put failure') }
      assert.equal((await upload()).status, 502)
      assert.equal((await pool.unsafe('select count(*)::int as count from review_media'))[0].count, 0)
      deleteHook = async () => { throw new Error('simulated delete failure') }
      assert.equal((await upload()).status, 502)
      assert.equal((await pool.unsafe('select state from review_media'))[0].state, 'deleting')
      await reset()

      // Two initial saves share the upsert's real ID; each response contains the media actually saved.
      await seed('one'); await seed('two')
      const sameAlbum = await Promise.all([save('same', ['one']), save('same', ['two'])])
      assert.deepEqual(sameAlbum.map(r => r.status), [200, 200])
      assert.equal(sameAlbum[0].body.data.id, sameAlbum[1].body.data.id)
      assert.deepEqual(sameAlbum.map(r => r.body.data.media[0].id), ['one', 'two'])
      assert.equal((await pool.unsafe('select count(*)::int as count from user_review'))[0].count, 1)
      await reset()

      // A shared upload can be claimed by only one album; the rejected save changes no review.
      await seed('shared')
      const differentAlbums = await Promise.all([save('a', ['shared']), save('b', ['shared'])])
      assert.deepEqual(differentAlbums.map(r => r.status).sort(), [200, 400])
      const winner = differentAlbums.find(r => r.status === 200).body.data
      assert.equal((await pool.unsafe('select "reviewId" from review_media'))[0].reviewId, winner.id)
      assert.equal((await pool.unsafe('select count(*)::int as count from user_review'))[0].count, 1)
      assert.equal((await save(winner.albumId, ['shared'], 'edited')).status, 200)
      await seed('foreign', 8, 'other')
      assert.equal((await save(winner.albumId, ['foreign'], 'rejected')).status, 400)
      assert.equal((await pool.unsafe('select content from user_review'))[0].content, 'edited')
      await reset()

      // Cleanup claims before touching R2. A save cannot attach a claimed row, even while deletion is held.
      await seed('old'); objects.add('old')
      await pool.unsafe('update review_media set "createdAt" = now() - interval \'2 days\'')
      const deletion = gate(); const deleting = gate()
      deleteHook = async () => { deleting.release(); await deletion.promise }
      const sweep = sweepDetachedMedia()
      await deleting.promise
      assert.equal((await save('late', ['old'])).status, 400)
      deletion.release()
      assert.equal(await sweep, 1)
      assert.equal(objects.size, 0)
      await reset()

      // If the save wins, cleanup leaves its object alone; a failed sweep remains retryable.
      await seed('keep'); objects.add('keep')
      await pool.unsafe('update review_media set "createdAt" = now() - interval \'2 days\'')
      assert.equal((await save('keep', ['keep'])).status, 200)
      assert.equal(await sweepDetachedMedia(), 0)
      assert.equal(objects.size, 1)
      await seed('retry'); objects.add('retry')
      await pool.unsafe('update review_media set "createdAt" = now() - interval \'2 days\' where id = \'retry\'')
      deleteHook = async () => { throw new Error('try again') }
      await assert.rejects(sweepDetachedMedia())
      assert.equal((await save('retry', ['retry'])).status, 400)
      deleteHook = async () => {}
      assert.equal(await sweepDetachedMedia(), 1)
      assert(objects.has('keep'))

      const gifResponse = await app.handle(new Request('http://localhost/api/me/reviews/keep', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'GIF edit', gif: { url: 'https://static.klipy.com/test.webp', width: 10, height: 10, alt: 'record' } }),
      }))
      assert.equal(gifResponse.status, 200)
      const gifReview = (await gifResponse.json()).data
      assert.equal(gifReview.media.length, 1)
      assert.equal(gifReview.media[0].kind, 'gif')
      assert.equal(gifReview.media[0].alt, 'record')
      assert.equal((await pool.unsafe('select "reviewId" from review_media where id = \'keep\''))[0].reviewId, null)

      // The shared cache keeps nulls as hits, overwrites keys, and treats and sweeps expired rows as misses.
      const { sharedGet, sharedSet, sweepSharedCache, pauseService, isServicePaused } = await import('./src/core/sharedCache.ts')
      await sharedSet('logo:none', null, 60_000)
      assert.deepEqual(await sharedGet('logo:none'), { value: null })
      await sharedSet('logo:none', 'https://example.com/logo.png', 60_000)
      assert.deepEqual(await sharedGet('logo:none'), { value: 'https://example.com/logo.png' })
      assert.equal(await sharedGet('missing'), null)
      assert.equal(await isServicePaused('apple'), false)
      await pauseService('apple', 60_000)
      assert.equal(await isServicePaused('apple'), true)
      await sharedSet('stale', 1, -1000)
      assert.equal(await sharedGet('stale'), null)
      await sweepSharedCache()
      assert.deepEqual((await pool.unsafe('select key from shared_cache order by key')).map(row => row.key), ['logo:none', 'pause:apple'])

      // Exercise a real service key so a memory hit cannot hide a failed Postgres write.
      const { findStreamingLinks } = await import('./src/services/streamingLinks.ts')
      const links = await findStreamingLinks('Cache Artist', 'Cache Album', async url => new Response(JSON.stringify(
        url.includes('/release-group/?query=')
          ? { 'release-groups': [{ id: 'cachedalbum', title: 'Cache Album', 'primary-type': 'Album', 'artist-credit': [{ name: 'Cache Artist' }] }] }
          : { releases: [{ relations: [{ url: { resource: 'https://open.spotify.com/album/cachedalbum' } }] }] },
      )))
      assert.deepEqual(links, { spotify: 'https://open.spotify.com/album/cachedalbum' })
      assert.deepEqual(await sharedGet('streaming:' + JSON.stringify(['cache artist', 'cache album'])), { value: links })
      const { findStreamingLinks: coldStreamingLinks } = await import('./src/services/streamingLinks.ts?cold')
      assert.deepEqual(await coldStreamingLinks('Cache Artist', 'Cache Album', async () => { throw new Error('cache should avoid upstream') }), links)

      // Pauses set by another worker cover streaming, artist images and artist logos.
      const { findArtistImage, findArtistLogo, searchAppleMusic } = await import('./src/services/artistImages.ts')
      await pauseService('musicbrainz', 60_000)
      const requests = []
      const pausedFetcher = async url => {
        requests.push(url)
        return new Response(JSON.stringify({ artists: [], data: [{ name: 'Paused Image', picture_xl: 'https://cdn-images.dzcdn.net/images/artist/fallback/1000x1000.jpg' }] }))
      }
      const imageFailure = await findArtistImage('Paused Image', pausedFetcher, 'fanart-key').catch(error => error)
      assert.equal(imageFailure.fallback?.source, 'deezer')
      assert.equal(await sharedGet('artist-image:paused image'), null)
      await assert.rejects(() => findArtistLogo('Paused Logo', pausedFetcher, { audioDb: 'test', fanart: 'fanart-key' }), /A logo source failed/)
      assert.equal(requests.some(url => url.includes('music.apple.com') || url.includes('musicbrainz.org')), false)
      await assert.rejects(() => findStreamingLinks('Paused Artist', 'Paused Album', pausedFetcher), /MusicBrainz is rate limited/)

      // The route still returns the fallback, but it must not be saved by a browser or edge cache.
      const { artistRoutes } = await import('./src/routes/artists.ts')
      const originalFetch = globalThis.fetch
      globalThis.fetch = pausedFetcher
      try {
        const response = await new Elysia().use(artistRoutes).handle(new Request('http://localhost/api/artist-image?name=Paused%20Image'))
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('Cache-Control'), 'no-store')
        assert.equal((await response.json()).source, 'deezer')
      } finally {
        globalThis.fetch = originalFetch
      }

      // Rate-limit responses from these callers publish pauses for other workers too.
      await pool.unsafe("delete from shared_cache where key like 'pause:%'")
      const recovered = await findArtistImage('Paused Image', async url => url.includes('/search?')
        ? new Response('<script id="serialized-server-data" type="application/json">' + JSON.stringify({ items: [{ title: 'Paused Image', contentDescriptor: { kind: 'artist', url: 'https://music.apple.com/us/artist/paused-image/1' } }] }) + '</script>')
        : new Response('<meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/AMCArtistImages211/v4/a/photo.png/1200x630cw.png">'))
      assert.equal(recovered.source, 'apple')
      let mbAttempts = 0
      assert.deepEqual(await findStreamingLinks('Retry Artist', 'Retry Album', async () => new Response(
        JSON.stringify({ 'release-groups': [] }), { status: ++mbAttempts === 1 ? 503 : 200 },
      )), {})
      assert.equal(mbAttempts, 2)
      assert.equal(await isServicePaused('musicbrainz'), false)
      await assert.rejects(() => searchAppleMusic('Limited Artist', async () => new Response('', { status: 429 })), /429/)
      assert.equal(await isServicePaused('apple'), true)
      await assert.rejects(() => findStreamingLinks('Limited Artist', 'Limited Album', async () => new Response('', { status: 429 })), /429/)
      assert.equal(await isServicePaused('musicbrainz'), true)

      // List writes go through Neon batches, and a double-tapped add stays one row instead of a 500.
      const listCall = async (path, body) => {
        const response = await app.handle(new Request('http://localhost/api/me/lists' + path, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        }))
        return { status: response.status, body: await response.json() }
      }
      const createdList = await listCall('', { name: 'Batch', album: { id: 'list-album' } })
      assert.equal(createdList.status, 200, JSON.stringify(createdList.body))
      assert.equal(createdList.body.data.added, true)
      const listId = createdList.body.data.id
      const listRows = () => pool.unsafe('select "albumId" from user_list_album where "listId" = $1 order by "albumId"', [listId])
      assert.deepEqual((await listRows()).map(row => row.albumId), ['list-album'])
      assert.equal((await listCall('/' + listId + '/toggle', { id: 'list-album' })).body.data.added, false)
      assert.equal((await listRows()).length, 0)
      const adds = await Promise.all([1, 2].map(() => listCall('/' + listId + '/toggle', { id: 'second' })))
      assert.deepEqual(adds.map(add => add.status), [200, 200])
      assert.deepEqual((await listRows()).map(row => row.albumId), ['second'])

      await pool.unsafe('drop table review_media')
      assert.equal((await save('text', [])).status, 200)
      console.log('media concurrency checks passed')
    } finally {
      await pool.close()
      await admin.unsafe('drop database "' + name + '" with (force)')
      await admin.close()
    }
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname,
    stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  expect(exitCode, stderr).toBe(0)
  expect(stdout).toContain('media concurrency checks passed')
}, 30_000)
