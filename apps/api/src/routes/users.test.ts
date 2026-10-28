import { expect, test } from 'bun:test'

test('profile covers persist uploads, preserve unchanged links, replace, reject invalid input, and remove', async () => {
  // Isolate module mocks and placeholder credentials from the suite and the developer's database.
  const script = `
    import assert from 'node:assert/strict'
    import { mock } from 'bun:test'
    import { Elysia } from 'elysia'
    import { PgDialect } from 'drizzle-orm/pg-core'
    import { user, userCover, userProfile } from './src/core/schema.ts'

    const dialect = new PgDialect()
    const owner = { id: 'cover-owner', image: null, updatedAt: new Date() }
    const profile = { userId: owner.id, username: 'cover-owner', bio: '', isPublic: true }
    let cover = null
    let coverWrites = 0
    let signedIn = true
    const matchesOwner = (condition) => dialect.sqlToQuery(condition).params.includes(owner.id)
    mock.module('./src/auth.ts', () => ({ auth: { api: { getSession: async () => signedIn ? { user: owner } : null } } }))
    mock.module('./src/core/db.ts', () => ({ db: {
      select: () => ({ from: (table) => ({ where: (condition) => ({ limit: async (limit) => {
        assert.equal(limit, 1)
        if (!matchesOwner(condition)) return []
        if (table === userCover) return cover ? [{ ...cover }] : []
        if (table === userProfile) return [{ ...profile }]
        if (table === user) return [{ ...owner }]
        throw new Error('Unexpected select table')
      } }) }) }),
      update: (table) => ({ set: (values) => ({ where: async (condition) => {
        assert.equal(table, userProfile)
        assert.ok(matchesOwner(condition))
        Object.assign(profile, values)
      } }) }),
      insert: (table) => ({ values: (values) => ({ onConflictDoUpdate: async (conflict) => {
        assert.equal(table, userCover)
        assert.equal(values.userId, owner.id)
        assert.equal(conflict.target, userCover.userId)
        assert.deepEqual(conflict.set, values)
        cover = { ...values }
        coverWrites++
      } }) }),
      delete: (table) => ({ where: async (condition) => {
        assert.equal(table, userCover)
        assert.ok(matchesOwner(condition))
        cover = null
        coverWrites++
      } }),
    } }))
    const { userRoutes } = await import('./src/routes/users.ts')
    const app = new Elysia().use(userRoutes)
    const put = (body) => app.handle(new Request('http://localhost/api/me/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }))
    const download = (url) => app.handle(new Request(url))
    const upload = (type, bytes) => 'data:' + type + ';base64,' + Buffer.from(bytes).toString('base64')
    const checkDownload = async (url, type, bytes) => {
      const response = await download(url)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), type)
      assert.match(response.headers.get('cache-control'), /immutable/)
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
    }

    assert.equal((await download('http://localhost/api/covers/' + owner.id)).status, 404)
    signedIn = false
    assert.equal((await put({ cover: upload('image/png', [1, 2, 3]) })).status, 401)
    assert.equal(coverWrites, 0)
    signedIn = true

    const firstBytes = Buffer.from([137, 80, 78, 71, 0, 255])
    const first = await put({ cover: upload('image/png', firstBytes) })
    assert.equal(first.status, 200)
    const firstUrl = (await first.json()).data.cover
    assert.match(firstUrl, /\\/api\\/covers\\/cover-owner\\?v=\\d+$/)
    assert.equal(cover.contentType, 'image/png')
    assert.equal(cover.data, firstBytes.toString('base64'))
    await checkDownload(firstUrl, 'image/png', firstBytes)
    assert.equal((await download('http://localhost/api/covers/someone-else')).status, 404)

    const originalStored = { ...cover }
    const unchanged = await put({ cover: firstUrl, bio: 'Changed bio' })
    assert.equal(unchanged.status, 200)
    assert.equal((await unchanged.json()).data.cover, firstUrl)
    assert.deepEqual(cover, originalStored)
    assert.equal(coverWrites, 1)
    const omitted = await put({ bio: 'Another bio' })
    assert.equal(omitted.status, 200)
    assert.equal((await omitted.json()).data.cover, firstUrl)
    assert.equal(coverWrites, 1)

    for (const invalid of [
      'https://example.com/cover.jpg',
      'http://localhost:4000/api/covers/someone-else?v=1',
      'data:image/svg+xml;base64,PHN2Zy8+',
      'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024),
      {}, false, 0,
    ]) {
      const response = await put({ cover: invalid })
      assert.equal(response.status, 400, JSON.stringify(invalid).slice(0, 120))
      assert.deepEqual(cover, originalStored)
      assert.equal(coverWrites, 1)
    }

    // Ensure the replacement timestamp differs even on fast machines.
    await new Promise((resolve) => setTimeout(resolve, 2))
    const nextBytes = Buffer.from([255, 216, 255, 0, 128])
    const replacement = await put({ cover: upload('image/jpeg', nextBytes) })
    assert.equal(replacement.status, 200)
    const replacementUrl = (await replacement.json()).data.cover
    assert.notEqual(replacementUrl, firstUrl)
    assert.equal(coverWrites, 2)
    assert.equal(cover.data, nextBytes.toString('base64'))
    await checkDownload(replacementUrl, 'image/jpeg', nextBytes)

    const boundaryBytes = Buffer.alloc(2 * 1024 * 1024, 42)
    const boundary = await put({ cover: upload('image/png', boundaryBytes) })
    assert.equal(boundary.status, 200)
    const boundaryUrl = (await boundary.json()).data.cover
    assert.equal(cover.data, boundaryBytes.toString('base64'))
    assert.equal(coverWrites, 3)
    await checkDownload(boundaryUrl, 'image/png', boundaryBytes)
    const boundaryStored = { ...cover }
    const oversized = await put({ cover: upload('image/png', Buffer.alloc(boundaryBytes.length + 1, 42)) })
    assert.equal(oversized.status, 400)
    assert.deepEqual(cover, boundaryStored)
    assert.equal(coverWrites, 3)
    await checkDownload(boundaryUrl, 'image/png', boundaryBytes)

    for (const removal of [null, '']) {
      const removed = await put({ cover: removal })
      assert.equal(removed.status, 200)
      assert.equal((await removed.json()).data.cover, null)
      assert.equal(cover, null)
      assert.equal((await download(replacementUrl)).status, 404)
    }
    console.log('cover lifecycle verified')
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname,
    env: {
      ...process.env,
      DATABASE_URL: 'postgres://user:pass@localhost:5432/test',
      BETTER_AUTH_URL: 'http://localhost:4000',
      BETTER_AUTH_SECRET: 'test-secret-that-is-long-enough-for-better-auth',
    },
    stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  expect(exitCode, stderr).toBe(0)
  expect(stderr).toBe('')
  expect(stdout.trim()).toBe('cover lifecycle verified')
})
