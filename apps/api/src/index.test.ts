import { expect, test } from 'bun:test'

// A child process so the app loads with placeholder env instead of the developer's real database.
const runScript = async (script: string) => {
  const child = Bun.spawn([process.execPath, '--eval', script], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      DATABASE_URL: 'postgres://user:pass@localhost:5432/test',
      BETTER_AUTH_URL: 'http://localhost:4000',
      BETTER_AUTH_SECRET: 'test-secret-that-is-long-enough-for-better-auth',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])

  expect(exitCode).toBe(0)
  return { stderr, result: JSON.parse(stdout.trim().split('\n').at(-1)!) }
}

test('edge-cacheable responses are marked no-transform, others keep their Cache-Control', async () => {
  const { stderr, result } = await runScript(`
    const { createApp } = await import('./src/index.ts')
    const app = createApp()
      .get('/edge', ({ set }) => { set.headers['Cache-Control'] = 'public, max-age=60, s-maxage=300'; return {} })
      .get('/private', ({ set }) => { set.headers['Cache-Control'] = 'no-store'; return {} })
    const read = async (path) => (await app.handle(new Request('http://localhost' + path))).headers.get('cache-control')
    console.log(JSON.stringify([await read('/edge'), await read('/private')]))
  `)

  expect(stderr).toBe('')
  expect(result).toEqual(['public, max-age=60, s-maxage=300, no-transform', 'no-store'])
})

test('unexpected errors return a generic body instead of the thrown message', async () => {
  const { result } = await runScript(`
    const { t } = await import('elysia')
    const { createApp } = await import('./src/index.ts')
    const app = createApp()
      .get('/plain', () => { throw new Error('relation "secret_table" does not exist') })
      // Postgres and network errors carry their own code, which Elysia adopts as the error code.
      .get('/coded', () => { throw Object.assign(new Error('violates "secret_index"'), { code: '23505' }) })
      .get('/status', ({ set }) => { set.status = 503; throw new Error('secret upstream') })
      .get('/validated', ({ query }) => query, { query: t.Object({ n: t.Numeric() }) })
    const read = async (path) => {
      const response = await app.handle(new Request('http://localhost' + path))
      return { status: response.status, requestId: response.headers.get('x-request-id'), body: await response.text() }
    }
    console.log(JSON.stringify(await Promise.all(['/plain', '/coded', '/status', '/validated?n=x'].map(read))))
  `)

  const [plain, coded, status, validated] = result
  expect([plain.status, coded.status, status.status, validated.status]).toEqual([500, 500, 503, 422])
  for (const response of [plain, coded, status]) {
    expect(response.body).not.toContain('secret')
    expect(JSON.parse(response.body)).toEqual({ error: 'Something went wrong. Please try again.', requestId: response.requestId })
  }
  expect(JSON.parse(validated.body).type).toBe('validation')
})
