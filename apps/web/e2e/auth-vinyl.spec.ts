import { expect, test } from '@playwright/test'

import { albumCatalog, installApiMocks } from './support/mockApi'

test('the sign-in record spins through albums by drag and keyboard', async ({ page }) => {
  await installApiMocks(page)
  await page.goto('/auth')
  const record = page.getByRole('slider', { name: 'Spin the record to browse albums' })
  await expect(page.getByRole('link', { name: new RegExp(albumCatalog[0].name) })).toBeVisible()

  // Drag a quarter turn clockwise and hold before letting go, so there is no flick: one album along.
  const box = await record.boundingBox()
  const [cx, cy, r] = [box!.x + box!.width / 2, box!.y + box!.height / 2, box!.width * 0.4]
  await page.mouse.move(cx + r, cy)
  await page.mouse.down()
  for (let deg = 10; deg <= 90; deg += 10) {
    const rad = (deg * Math.PI) / 180
    await page.mouse.move(cx + r * Math.cos(rad), cy + r * Math.sin(rad))
  }
  await page.waitForTimeout(150)
  await page.mouse.up()
  await expect(record).toHaveAttribute('aria-valuenow', '2')
  await expect(page.getByRole('link', { name: new RegExp(albumCatalog[1].name) })).toBeVisible()

  await record.press('ArrowRight')
  await expect(record).toHaveAttribute('aria-valuenow', '3')
  await record.press('ArrowLeft')
  await record.press('ArrowLeft')
  await expect(record).toHaveAttribute('aria-valuenow', '1')
})
