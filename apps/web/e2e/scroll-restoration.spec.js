import { expect, test } from '@playwright/test'
import { albumCatalog, installApiMocks } from './support/mockApi'

test('back restores a deep scroll after the query cache expires and content finishes loading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await installApiMocks(page)
  let requests = 0
  let finishLoading
  const loading = new Promise((resolve) => { finishLoading = resolve })
  await page.route('**/api/featured?*', async (route) => {
    requests += 1
    if (requests > 1) await loading
    await route.fulfill({ json: { data: Array.from({ length: 24 }, (_, index) => ({ ...albumCatalog[0], id: `m:${index}` })) } })
  })
  await page.goto('/discover')
  await expect(page.locator('[data-album-card]')).toHaveCount(24)
  await page.evaluate(() => window.scrollTo(0, 1800))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1800)
  // A keyboard click leaves the scroll position intact before navigating away.
  await page.getByRole('banner').getByRole('link', { name: 'Home', exact: true }).evaluate((link) => link.click())
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1, name: albumCatalog[0].name })).toBeVisible()
  await page.clock.fastForward('01:01:00')
  await page.goBack()
  await expect.poll(() => requests).toBe(2)
  await expect(page.locator('[data-album-card]')).toHaveCount(0)
  finishLoading()
  await expect(page.locator('[data-album-card]')).toHaveCount(24)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1800)
})
