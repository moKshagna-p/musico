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
    const { createApp } = await import('./src/index.ts')
    const app = createApp().get('/boom', () => { throw new Error('relation "secret_table" does not exist') })
    const response = await app.handle(new Request('http://localhost/boom'))
    console.log(JSON.stringify({ status: response.status, requestId: response.headers.get('x-request-id'), body: await response.text() }))
  `)

  expect(result.status).toBe(500)
  expect(result.body).not.toContain('secret_table')
  expect(JSON.parse(result.body)).toEqual({ error: 'Something went wrong. Please try again.', requestId: result.requestId })
})
