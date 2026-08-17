import { expect, test } from 'bun:test'

import { env } from './env'

test('uses full homepage snapshots unless minimal refresh is explicitly enabled', () => {
  expect(env.HOMEPAGE_REFRESH_MINIMAL).toBe(false)
})

test('refreshes the Worker homepage snapshot every six hours', async () => {
  const config = await Bun.file(new URL('../../wrangler.toml', import.meta.url)).text()
  expect(config).toContain('crons = ["0 */6 * * *"]')
})
