import { expect, test } from '@playwright/test'
import { installApiMocks } from './support/mockApi'

test('wheel combines Musico lists, adds albums, spins, and persists an empty pool', async ({ page }) => {
  await installApiMocks(page)
  const albums = Array.from({ length: 10 }, (_, index) => ({
    id: String(index + 1), name: `Record ${index + 1}`, artists: ['Artist'], cover: '',
  }))
  await page.route('**/api/me/dashboard', route => route.fulfill({
    json: {
      ratings: {}, recentRatings: [], profile: { username: 'e2e-user', name: 'E2E User' },
      lists: [
        { id: 'first', name: 'First list', albums: albums.slice(0, 2) },
        { id: 'second', name: 'Second list', albums },
      ],
    },
  }))
  await page.goto('/auth')
  await page.getByLabel(/email/i).fill('e2e@musico.dev')
  await page.getByLabel(/password/i).fill('password123')
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/profile')
  const wheel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'The Listening Wheel' }) })
  await wheel.getByRole('button', { name: /Edit wheel/ }).click()
  await wheel.getByLabel('Add a Musico list').selectOption('second')
  await wheel.getByRole('button', { name: 'Add list', exact: true }).click()
  await expect(wheel.getByText('In your wheel · 10')).toBeVisible()
  await wheel.getByRole('button', { name: 'Add list', exact: true }).click()
  await expect(wheel.getByText('In your wheel · 10')).toBeVisible()
  await wheel.getByLabel('Add individual albums').fill('Discovery')
  await wheel.getByRole('button', { name: /Discovery/ }).click()
  await expect(wheel.getByText('In your wheel · 11')).toBeVisible()
  await wheel.getByRole('button', { name: 'Remove Discovery' }).click()
  await page.evaluate(() => { Math.random = () => 0.99 })
  await wheel.getByRole('button', { name: 'Spin listening wheel' }).click()
  await expect(wheel.getByRole('button', { name: 'Add list', exact: true })).toBeDisabled()
  await expect(wheel.getByRole('status')).toContainText('Record 10', { timeout: 6000 })
  await expect(wheel.getByRole('button', { name: 'Spin listening wheel' })).toBeEnabled()
  await page.reload()
  await wheel.getByRole('button', { name: /Edit wheel/ }).click()
  await expect(wheel.getByText('In your wheel · 10')).toBeVisible()
  await wheel.getByRole('button', { name: 'Clear wheel' }).click()
  await expect(wheel.getByRole('button', { name: 'Spin listening wheel' })).toBeDisabled()
  await page.reload()
  await expect(wheel.getByText('In your wheel · 0')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(wheel.getByLabel('Add individual albums')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
