import { expect, test } from '@playwright/test'

import { installApiMocks } from './support/mockApi'

test('hero video follows the phone breakpoint in both directions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1024, height: 900 })
  await installApiMocks(page)
  await page.route('**/api/artist-image?*', (route) => route.fulfill({ json: {
    image: 'https://example.com/wide.jpg', source: 'apple', kind: 'editorial',
    video: 'https://example.com/wide.m3u8',
    square: { image: 'https://example.com/square.jpg', video: 'https://example.com/square.m3u8' },
  } }))
  await page.route('https://example.com/**', (route) => route.fulfill({ body: '' }))
  // Exercise the native HLS source selection without depending on external video playback.
  await page.addInitScript(() => { HTMLVideoElement.prototype.canPlayType = () => 'probably' })
  await page.goto('/album/m:1001')
  const video = page.locator('section video')
  await expect(video).toHaveAttribute('src', 'https://example.com/wide.m3u8')
  await page.setViewportSize({ width: 1023, height: 900 })
  await expect(video).toHaveAttribute('src', 'https://example.com/square.m3u8')
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(video).toHaveAttribute('src', 'https://example.com/wide.m3u8')
})
