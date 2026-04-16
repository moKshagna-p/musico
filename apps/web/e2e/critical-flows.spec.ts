import { expect, test } from '@playwright/test'

import { installApiMocks } from './support/mockApi'

test.describe('Critical user flows', () => {
  const signIn = async (page) => {
    await page.goto('/auth')
    await page.getByLabel(/email/i).fill('e2e@musico.dev')
    await page.getByLabel(/password/i).fill('password123')
    await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()
    await expect(page).toHaveURL('/')
  }

  test.beforeEach(async ({ page }) => {
    await installApiMocks(page)
  })

  test('auth flow signs in and navigates to home', async ({ page }) => {
    await signIn(page)
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible()
  })

  test('search flow submits query and opens album details', async ({ page }) => {
    await page.goto('/discover')

    const searchInput = page.getByPlaceholder(/search artists or albums/i)
    await searchInput.fill('daft punk')
    await searchInput.press('Enter')

    await expect(page).toHaveURL(/\/search\?q=daft%20punk/i)
    await expect(page.getByRole('heading', { name: /daft punk/i })).toBeVisible()

    await page.locator('article').filter({ hasText: 'Discovery' }).first().click()
    await expect(page).toHaveURL(/\/album\//)
    await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible()
  })

  test('list flow creates list and toggles album in listen later', async ({ page }) => {
    await signIn(page)

    await page.goto('/album/m:1001')
    await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible()

    await page.getByRole('button', { name: /toggle listen later/i }).click()
    await expect(page.getByText(/added to listen later|created listen later and added this album/i)).toBeVisible()

    await page.getByPlaceholder('New list').fill('Roadtrip')
    await page.getByRole('button', { name: /create list/i }).click()
    await expect(page.getByText(/created roadtrip and added this album|created roadtrip\./i)).toBeVisible()
  })

  test('review flow posts a review and shows it in list', async ({ page }) => {
    await signIn(page)

    await page.goto('/album/m:1002')
    await expect(page.getByRole('heading', { name: 'Random Access Memories' })).toBeVisible()

    await page.getByPlaceholder(/write a short review/i).fill('Incredible production and timeless grooves.')
    await page.getByRole('button', { name: /^post$/i }).click()

    await expect(page.getByText(/review posted\./i)).toBeVisible()
    await expect(page.locator('p', { hasText: /incredible production and timeless grooves\./i }).first()).toBeVisible()
  })
})
