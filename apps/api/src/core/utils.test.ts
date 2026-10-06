import { expect, test } from 'bun:test'

test('profile previews await missing metadata, reuse fresh cache, and tolerate provider failures', async () => {
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
      return { name: 'Hydrated', artists: ['Current artist'], genres: ['Rock'] }
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
  expect(calls).toEqual(['m:2', 'm:3'])
  const result = new Map(previews)
  expect(result.get('m:1').name).toBe('Cached')
  expect(result.get('m:2').artists).toEqual(['Current artist'])
  expect(result.get('m:2').genres).toEqual(['Rock'])
  expect(result.has('m:3')).toBe(false)
})
