import { expect, test } from '@playwright/test'

import { albumCatalog, installApiMocks } from './support/mockApi'

test('the sign-in record spins through albums by drag and keyboard', async ({ page }) => {
  await installApiMocks(page)
  await page.goto('/auth')
  const record = page.getByRole('slider', { name: 'Spin the record to browse albums' })
  await expect(page.getByRole('link', { name: new RegExp(albumCatalog[0].name) })).toBeVisible()

  // Drag a quarter turn clockwise and hold before letting go, so there is no flick: one album along.
  const box = await record.boundingBox()
  expect(box).not.toBeNull()
  const [cx, cy, r] = [box.x + box.width / 2, box.y + box.height / 2, box.width * 0.4]
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

test.describe('touch ownership', () => {
  test.use({ hasTouch: true, reducedMotion: 'reduce' })

  for (const ending of ['cancel', 'lost capture']) {
    test(`only the first pointer controls the record and ${ending} ends its drag`, async ({ page, context }) => {
      await installApiMocks(page)
      await page.goto('/auth')
      const record = page.getByRole('slider', { name: 'Spin the record to browse albums' })
      await expect(record).toHaveAttribute('aria-valuemax', String(albumCatalog.length))
      const box = await record.boundingBox()
      expect(box).not.toBeNull()
      const point = (id, degrees) => ({
        id,
        x: box.x + box.width / 2 + box.width * 0.4 * Math.cos(degrees * Math.PI / 180),
        y: box.y + box.height / 2 + box.height * 0.4 * Math.sin(degrees * Math.PI / 180),
      })
      await record.evaluate((element) => element.addEventListener('pointerdown', (event) => {
        element.dataset.firstPointer = String(event.pointerId)
      }, { once: true }))
      const touch = await context.newCDPSession(page)
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, 0)] })
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, 0), point(2, 180)] })
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, 30), point(2, 120)] })
      await expect(record).toHaveAttribute('aria-valuenow', '1')
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, 30)] })
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, 90)] })
      await expect(record).toHaveAttribute('aria-valuenow', '2')

      if (ending === 'lost capture') {
        await record.evaluate((element) => element.releasePointerCapture(Number(element.dataset.firstPointer)))
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, 160)] })
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      await page.waitForTimeout(150)
      await expect(record).toHaveAttribute('aria-valuenow', '2')
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(3, 0)] })
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(3, 100)] })
      await expect(record).toHaveAttribute('aria-valuenow', '1')
      await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    })
  }
})

test('the record only mounts and loads albums while its column is visible', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 900 })
  await page.addInitScript(() => {
    const NativeImage = window.Image
    window.vinylImageWarms = 0
    window.Image = class extends NativeImage {
      constructor(...args) {
        super(...args)
        window.vinylImageWarms += 1
      }
    }
  })
  const homeRequests = []
  const albumImages = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/home') homeRequests.push(request.url())
    if (albumCatalog.some((album) => album.cover === request.url())) albumImages.push(request.url())
  })
  await installApiMocks(page)
  await page.goto('/auth')
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible()
  const record = page.getByRole('slider', { name: 'Spin the record to browse albums', includeHidden: true })
  await expect(record).toHaveCount(0)
  expect(homeRequests).toHaveLength(0)
  expect(albumImages).toHaveLength(0)
  expect(await page.evaluate(() => window.vinylImageWarms)).toBe(0)

  await page.setViewportSize({ width: 768, height: 900 })
  await expect(record).toBeVisible()
  await expect(record).toHaveAttribute('aria-valuemax', String(albumCatalog.length))
  await expect.poll(() => homeRequests.length).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => window.vinylImageWarms)).toBeGreaterThan(0)
  await page.setViewportSize({ width: 767, height: 900 })
  await expect(record).toHaveCount(0)
})

test('reduced motion keeps the idle label still while keyboard browsing works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installApiMocks(page)
  await page.goto('/auth')
  const record = page.getByRole('slider', { name: 'Spin the record to browse albums' })
  await expect(record).toHaveAttribute('aria-valuemax', String(albumCatalog.length))
  const rotation = () => record.locator(':scope > div').evaluate((element) => getComputedStyle(element).transform)
  const idle = await rotation()
  await page.waitForTimeout(200)
  expect(await rotation()).toBe(idle)
  await record.press('ArrowRight')
  await expect(record).toHaveAttribute('aria-valuenow', '2')
  await expect.poll(rotation).not.toBe(idle)
})
