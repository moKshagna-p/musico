import { expect, test, type Page } from '@playwright/test'

import { installApiMocks } from './support/mockApi'

const signIn = async (page: Page) => {
  await page.goto('/auth')
  await page.getByLabel(/email/i).fill('e2e@musico.dev')
  await page.getByLabel(/password/i).fill('password123')
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL('/')
}

test('members without the admin role are sent home and see no admin link', async ({ page }) => {
  await installApiMocks(page)
  await signIn(page)
  await expect(page.getByRole('banner').getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)

  await page.goto('/admin')
  await expect(page).toHaveURL('/')
})

test('admins moderate flagged reviews from the dashboard, on phones too', async ({ page }) => {
  await installApiMocks(page, { admin: true })
  await signIn(page)
  await page.getByRole('banner').getByRole('link', { name: 'Admin', exact: true }).click()
  await expect(page).toHaveURL('/admin')

  await expect(page.getByRole('heading', { level: 1, name: 'Operations' })).toBeVisible()
  await expect(page.getByText('e2e@musico.dev')).toBeVisible()
  await expect(page.getByText('Still the best Daft Punk record.')).toBeVisible()

  await page.getByRole('button', { name: 'Flagged', exact: true }).click()
  await expect(page.getByText('Still the best Daft Punk record.')).toHaveCount(0)
  const flagged = page.locator('article').filter({ hasText: 'Promo Bot' })
  await flagged.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('Removed review on Homework.')).toBeVisible()
  await expect(page.getByText('No reviews matched this filter.')).toBeVisible()

  await page.getByPlaceholder('Search users').fill('nobody-matches')
  await expect(page.getByText('No users found.')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await expect(page.getByText('Still the best Daft Punk record.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
