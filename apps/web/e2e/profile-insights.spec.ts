import { expect, test } from '@playwright/test'
import { installApiMocks } from './support/mockApi'

test('profile shows the rating spread and listening diary without overflowing on phones', async ({ page }) => {
  await installApiMocks(page)
  const now = Date.now()
  const day = 86_400_000
  await page.route('**/api/me/dashboard', route => route.fulfill({
    json: {
      ratings: {
        a: { rating: 4, timestamp: now },
        b: { rating: 4, timestamp: now - day },
        c: { rating: 2.5, timestamp: now - 3 * day },
      },
      ratingSummary: { totalRated: 3, averageRating: 3.5 },
      recentRatings: [], lists: [], profile: { username: 'e2e-user', name: 'E2E User' },
    },
  }))
  await page.goto('/auth')
  await page.getByLabel(/email/i).fill('e2e@musico.dev')
  await page.getByLabel(/password/i).fill('password123')
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/profile')

  await expect(page.getByText('Fair, but firm. Mostly 4 stars.')).toBeVisible()
  await page.getByRole('button', { name: '2½ stars: 1 album' }).click()
  await expect(page.getByText('1 album at 2½ stars, 33% of your ratings.')).toBeVisible()
  await expect(page.getByText('3 records rated in the past year.')).toBeVisible()
  await expect(page.getByRole('img', { name: '3 ratings across 3 days in the past year' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '4 stars: 2 albums' }).click()
  await expect(page.getByText('2 albums at 4 stars, 67% of your ratings.')).toBeVisible()
  await page.locator('[data-week]').last().click()
  await expect(page.getByText('1 rating today')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
