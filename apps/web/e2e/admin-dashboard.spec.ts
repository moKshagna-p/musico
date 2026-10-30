import { expect, test, type Page } from '@playwright/test'

import { installApiMocks } from './support/mockApi'

const signIn = async (page: Page) => {
  await page.goto('/auth')
  await page.getByLabel(/email/i).fill('e2e@musico.dev')
  await page.getByLabel(/password/i).fill('password123')
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL('/')
}

test('members without the admin role are sent home from /admin', async ({ page }) => {
  await installApiMocks(page)
  await signIn(page)
  await page.goto('/admin')
  await expect(page).toHaveURL('/')
})

test('admins open the dashboard by URL and moderate flagged reviews, on phones too', async ({ page }) => {
  await installApiMocks(page, { admin: true })
  await signIn(page)
  // The dashboard is deliberately left out of the navbar, even for admins.
  await expect(page.getByRole('banner').getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)

  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Operations' })).toBeVisible()
  await expect(page.getByText(/This\sweek\s4\speople\sjoined,\s31\srecords\swere\srated,\s1\sreview\swas\swritten\sand\s52\ssearches\sran\./)).toBeVisible()
  await expect(page.getByRole('list', { name: 'All time' })).toContainText('128 members')
  await expect(page.getByRole('link', { name: 'Daft Punk' })).toHaveAttribute('href', '/search?q=Daft%20Punk')

  // The queue opens on flagged reviews; removing one asks first.
  await expect(page.getByText('Still the best Daft Punk record.')).toHaveCount(0)
  const flagged = page.locator('article').filter({ hasText: 'Promo Bot' })
  await flagged.getByRole('button', { name: 'Remove', exact: true }).click()
  await flagged.getByRole('button', { name: 'Cancel' }).click()
  await expect(flagged).toBeVisible()
  await flagged.getByRole('button', { name: 'Remove', exact: true }).click()
  await flagged.getByRole('button', { name: 'Remove review' }).click()
  await expect(page.getByText('Removed review on Homework.')).toBeVisible()
  await expect(page.getByText('Nothing flagged. The queue is clear.')).toBeVisible()

  // Admins cannot remove their own access.
  await expect(page.locator('article').filter({ hasText: 'e2e@musico.dev' }).getByRole('button', { name: 'Remove admin' })).toBeDisabled()
  await page.getByPlaceholder('Search by name, email or username').fill('nobody-matches')
  await expect(page.getByText('No members match that search.')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'See all reviews' }).click()
  await expect(page.getByText('Still the best Daft Punk record.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
