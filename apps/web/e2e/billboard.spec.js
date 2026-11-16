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
  // Exercise the native HLS source selection (browsers without MediaSource, like iPhone Safari) without depending
  // on external video playback.
  await page.addInitScript(() => {
    HTMLVideoElement.prototype.canPlayType = () => 'probably'
    Object.defineProperty(window, 'MediaSource', { value: undefined })
  })
  await page.goto('/album/m:1001')
  const video = page.locator('section video')
  await expect(video).toHaveAttribute('src', 'https://example.com/wide.m3u8')
  await page.setViewportSize({ width: 1023, height: 900 })
  await expect(video).toHaveAttribute('src', 'https://example.com/square.m3u8')
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(video).toHaveAttribute('src', 'https://example.com/wide.m3u8')
})

// Chrome answers canPlayType for HLS but its native player rejects Apple's streams, so browsers with MediaSource must
// play through hls.js (a blob: source) even when they claim native support.
test('hero video uses hls.js where MediaSource exists, even if native HLS is claimed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1024, height: 900 })
  await installApiMocks(page)
  await page.route('**/api/artist-image?*', (route) => route.fulfill({ json: {
    image: 'https://example.com/wide.jpg', source: 'apple', kind: 'editorial', video: 'https://example.com/wide.m3u8', square: null,
  } }))
  await page.route('https://example.com/**', (route) => route.fulfill({ body: '' }))
  await page.addInitScript(() => { HTMLVideoElement.prototype.canPlayType = () => 'probably' })
  const playlist = page.waitForRequest('https://example.com/wide.m3u8')
  await page.goto('/album/m:1001')
  await playlist
  await expect(page.locator('section video')).toHaveAttribute('src', /^blob:/)
})
