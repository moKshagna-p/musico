import { expect, test } from 'bun:test'

test('edge-cacheable responses are marked no-transform, others keep their Cache-Control', async () => {
  // A child process so the app loads with placeholder env instead of the developer's real database.
  const script = `
    const { createApp } = await import('./src/index.ts')
    const app = createApp()
      .get('/edge', ({ set }) => { set.headers['Cache-Control'] = 'public, max-age=60, s-maxage=300'; return {} })
      .get('/private', ({ set }) => { set.headers['Cache-Control'] = 'no-store'; return {} })
    const read = async (path) => (await app.handle(new Request('http://localhost' + path))).headers.get('cache-control')
    console.log(JSON.stringify([await read('/edge'), await read('/private')]))
  `
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

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(JSON.parse(stdout.trim().split('\n').at(-1)!)).toEqual(['public, max-age=60, s-maxage=300, no-transform', 'no-store'])
})
