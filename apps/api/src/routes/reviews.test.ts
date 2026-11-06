import { expect, test } from 'bun:test'

test('your review of an album comes back with its attachments, and only yours', async () => {
  // Isolate module mocks and placeholder credentials from the suite and the developer's database.
  const script = `
    import assert from 'node:assert/strict'
    import { mock } from 'bun:test'
    import { Elysia } from 'elysia'
    import { PgDialect } from 'drizzle-orm/pg-core'
    import { reviewMedia, userReview } from './src/core/schema.ts'

    const dialect = new PgDialect()
    const owner = { id: 'reviewer', image: null, updatedAt: new Date() }
    const review = { id: 'review-1', userId: owner.id, albumId: 'album-1', content: 'Stayed with me', updatedAt: new Date(1700000000000) }
    const media = [
      { id: 'img-2', reviewId: review.id, kind: 'image', key: 'reviews/reviewer/img-2.webp', url: null, width: 800, height: 600, alt: 'second' },
      { id: 'gif-1', reviewId: 'other-review', kind: 'gif', key: null, url: 'https://static.klipy.com/x.gif', width: 200, height: 100, alt: '' },
    ]
    let signedIn = true
    const params = (condition) => dialect.sqlToQuery(condition).params
    mock.module('./src/auth.ts', () => ({ auth: { api: { getSession: async () => signedIn ? { user: owner } : null } } }))
    mock.module('./src/core/db.ts', () => ({ db: {
      select: () => ({ from: (table) => ({ where: (condition) => {
        const values = params(condition)
        if (table === userReview) {
          return { limit: async () => values.includes(review.userId) && values.includes(review.albumId) ? [{ ...review }] : [] }
        }
        if (table === reviewMedia) {
          const rows = media.filter((row) => values.includes(row.reviewId))
          const ordered = Promise.resolve(rows)
          return { orderBy: () => ordered }
        }
        throw new Error('Unexpected select table')
      } }) }),
    } }))
    const { reviewRoutes } = await import('./src/routes/reviews.ts')
    const app = new Elysia().use(reviewRoutes)
    const get = async (albumId) => {
      const response = await app.handle(new Request('http://localhost/api/me/reviews/' + albumId))
      return { status: response.status, body: await response.json() }
    }

    const mine = await get('album-1')
    assert.equal(mine.status, 200)
    assert.equal(mine.body.data.id, review.id)
    assert.equal(mine.body.data.content, 'Stayed with me')
    assert.equal(mine.body.data.updatedAt, 1700000000000)
    // Only this review's attachments, with image keys turned into served URLs.
    assert.deepEqual(mine.body.data.media.map((item) => [item.id, item.kind, item.width]), [['img-2', 'image', 800]])
    assert.match(mine.body.data.media[0].url, /img-2\\.webp$/)

    assert.deepEqual((await get('album-2')).body, { data: null })

    signedIn = false
    assert.equal((await get('album-1')).status, 401)
    console.log('own review verified')
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
  expect(stdout.trim()).toBe('own review verified')
})
