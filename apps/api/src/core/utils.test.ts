import { expect, test } from 'bun:test'

test('profile previews reuse stored catalog metadata without provider requests', async () => {
  const script = `
    import { mock } from 'bun:test'
    const calls = []
    mock.module('./src/core/db.ts', () => ({ db: { select: () => ({ from: () => ({ where: async () => [
      { releaseId: 'm:1', expiresAt: new Date(Date.now() + 60000), payload: { name: 'Cached', artists: ['Cached artist'] } },
      { releaseId: 'm:2', expiresAt: new Date(0), payload: { name: 'Expired', artists: ['Old artist'] } },
    ] }) }) } }))
    mock.module('./src/services/discogs.ts', () => ({ getReleaseDetails: async (id) => {
      calls.push(id)
      if (id === 'm:3') throw new Error('provider unavailable')
      await new Promise(resolve => setTimeout(resolve, 5))
      return { name: 'Hydrated', artists: ['Old artist'], genres: ['Rock'] }
    } }))
    const { getProfileReleasePreviewMap } = await import('./src/core/utils.ts')
    const previews = await getProfileReleasePreviewMap(['m:1', 'm:2', 'm:2', 'm:3'])
    console.log(JSON.stringify({ calls, previews: [...previews] }))
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname, stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(exitCode, stderr).toBe(0)
  const { calls, previews } = JSON.parse(stdout)
  expect(calls).toEqual([])
  const result = new Map(previews)
  expect(result.get('m:1').name).toBe('Cached')
  expect(result.get('m:2').artists).toEqual(['Old artist'])
  expect(result.get('m:2').name).toBe('Expired')
  expect(result.has('m:3')).toBe(false)
})

test('activity writes expose completion so routes can await persistence', async () => {
  const script = `
    import { mock } from 'bun:test'
    let finish
    let persisted = false
    mock.module('./src/core/db.ts', () => ({ db: { insert: () => ({ values: () => new Promise(resolve => {
      finish = () => { persisted = true; resolve() }
    }) }) } }))
    mock.module('./src/services/discogs.ts', () => ({ getReleaseDetails: async () => ({}) }))
    const { recordActivity } = await import('./src/core/utils.ts')
    let complete = false
    const pending = recordActivity({ userId: 'demo', type: 'listed' })
    const awaitable = !!pending && typeof pending.then === 'function'
    const waiter = Promise.resolve(pending).then(() => { complete = true })
    await Promise.resolve()
    const before = complete
    finish()
    await waiter
    console.log(JSON.stringify({ awaitable, before, complete, persisted }))
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname, stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(exitCode, stderr).toBe(0)
  expect(JSON.parse(stdout)).toEqual({ awaitable: true, before: false, complete: true, persisted: true })
})

test('rate limiting keys on the visitor behind the Vercel rewrite, not the shared proxy IP', async () => {
  const script = `
    const { getClientIp } = await import('./src/core/utils.ts')
    const ip = (headers) => getClientIp(new Request('https://api.test/', { headers }))
    console.log(JSON.stringify([
      ip({ 'cf-connecting-ip': '76.76.21.1', 'x-vercel-forwarded-for': '203.0.113.7, 10.0.0.1' }),
      ip({ 'cf-connecting-ip': '198.51.100.2' }),
      ip({ 'cf-connecting-ip': '198.51.100.2', 'x-vercel-forwarded-for': 'not-an-ip' }),
    ]))
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname, stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(exitCode, stderr).toBe(0)
  expect(JSON.parse(stdout)).toEqual(['203.0.113.7', '198.51.100.2', '198.51.100.2'])
})

test('re-rating replaces the earlier feed entry in one batch instead of stacking a new one', async () => {
  const script = `
    import { mock } from 'bun:test'
    const { PgDialect } = await import('drizzle-orm/pg-core')
    const batches = []
    mock.module('./src/core/db.ts', () => ({ db: {
      insert: () => ({ values: (row) => ({ op: 'insert', row }) }),
      delete: () => ({ where: (filter) => ({ op: 'delete', filter }) }),
      batch: async (queries) => { batches.push(queries) },
    } }))
    mock.module('./src/services/discogs.ts', () => ({ getReleaseDetails: async () => ({}) }))
    const { recordActivity } = await import('./src/core/utils.ts')
    await recordActivity({ userId: 'u1', type: 'rated', albumId: 'a1', metadata: { rating: 4 } })
    const [del, ins] = batches[0]
    const where = new PgDialect().sqlToQuery(del.filter)
    console.log(JSON.stringify({ count: batches.length, ops: [del.op, ins.op], where, rating: ins.row.metadata.rating }))
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname, stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(exitCode, stderr).toBe(0)
  const { count, ops, where, rating } = JSON.parse(stdout)
  expect(count).toBe(1)
  expect(ops).toEqual(['delete', 'insert'])
  expect(where.sql).toContain('"targetUserId" is null')
  expect(where.params).toEqual(['u1', 'rated', 'a1'])
  expect(rating).toBe(4)
})

test('a full rate-limit table evicts old IPs instead of refusing every new visitor', async () => {
  const script = `
    const { consumeRateLimit } = await import('./src/core/utils.ts')
    const { RATE_LIMIT_MAX, RATE_LIMIT_MAX_TRACKED_IPS } = await import('./src/core/constants.ts')
    for (let i = 0; i <= RATE_LIMIT_MAX; i++) consumeRateLimit('203.0.113.1')
    const allowedAfterMax = consumeRateLimit('203.0.113.1').allowed
    for (let i = 0; i < RATE_LIMIT_MAX_TRACKED_IPS + 1; i++) consumeRateLimit('spoofed-' + i)
    console.log(JSON.stringify({ allowedAfterMax, newVisitor: consumeRateLimit('198.51.100.9'), max: RATE_LIMIT_MAX }))
  `
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('../..', import.meta.url).pathname, stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(exitCode, stderr).toBe(0)
  const { allowedAfterMax, newVisitor, max } = JSON.parse(stdout)
  expect(allowedAfterMax).toBe(false)
  expect(newVisitor).toEqual({ allowed: true, remaining: max - 1, retryAfter: 60 })
})
