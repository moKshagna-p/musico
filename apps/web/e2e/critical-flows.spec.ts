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

  test('a stale previous session does not sign out a fresh login', async ({ page }) => {
    let signOutRequests = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/auth/sign-out') signOutRequests += 1
    })

    await page.goto('/auth')
    await page.evaluate(() => {
      window.localStorage.setItem('musico:last-activity-at', String(Date.now() - 21 * 60 * 1000))
    })
    await page.getByLabel(/email/i).fill('e2e@musico.dev')
    await page.getByLabel(/password/i).fill('password123')
    await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible()
    expect(signOutRequests).toBe(0)
  })

  test('navbar pages render their data and album links open details', async ({ page }) => {
    const browserErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
        browserErrors.push(message.text())
      }
    })
    page.on('response', (response) => {
      if (response.status() >= 500) browserErrors.push(`${response.status()} ${new URL(response.url()).pathname}`)
    })
    page.on('pageerror', (error) => browserErrors.push(error.message))

    await page.goto('/')
    await expect(page.getByRole('heading', { name: /most happening right now/i })).toBeVisible()
    await page.locator('article').filter({ hasText: 'Discovery' }).first().click()
    await expect(page).toHaveURL(/\/album\//)
    await expect(page.getByRole('heading', { name: 'Discovery' })).toHaveCount(1)
    await page.getByRole('link', { name: 'Home', exact: true }).click()

    await page.getByRole('link', { name: 'Discover', exact: true }).click()
    await expect(page.getByRole('heading', { name: /dig through the vault/i })).toBeVisible()
    await expect(page.locator('article').filter({ hasText: 'Discovery' }).first()).toBeVisible()

    const searchInput = page.getByPlaceholder(/search artists or albums/i)
    await searchInput.fill('daft punk')
    await searchInput.press('Enter')
    await expect(page).toHaveURL(/\/search\?q=daft%20punk/i)
    await page.locator('article').filter({ hasText: 'Discovery' }).first().click()
    await expect(page).toHaveURL(/\/album\//)
    await expect(page.getByRole('heading', { name: 'Discovery' })).toHaveCount(1)

    await page.getByRole('link', { name: 'Sign In', exact: true }).click()
    await expect(page).toHaveURL('/auth')
    await signIn(page)
    await page.getByRole('link', { name: 'Feed', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Feed', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Discovery', exact: true }).first().click()
    await expect(page).toHaveURL(/\/album\//)
    await expect(page.getByRole('heading', { name: 'Discovery' })).toHaveCount(1)

    await page.getByRole('link', { name: 'Profile', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'E2E User' })).toBeVisible()

    await page.getByRole('link', { name: 'Home', exact: true }).click()
    await expect(page.getByRole('heading', { name: /most happening right now/i })).toBeVisible()
    expect(browserErrors).toEqual([])
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

  test('search load more requests the next API offset', async ({ page }) => {
    const offsets: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/search' && url.searchParams.get('q') === 'pagination') {
        offsets.push(url.searchParams.get('offset') ?? '0')
      }
    })

    await page.goto('/search?q=pagination')
    await expect(page.getByText('Pagination Album 12')).toBeVisible()
    await page.getByRole('button', { name: /load more/i }).click()
    await expect(page.getByText('Pagination Album 13')).toBeVisible()

    expect(offsets.at(-1)).toBe('12')
  })

  test('short full-page searches request and render results', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/search') requests.push(url.searchParams.get('q') ?? '')
    })

    await page.goto('/search?q=U2')
    await expect(page.getByRole('heading', { name: 'U2', exact: true })).toBeVisible()
    await expect.poll(() => requests).toContain('U2')
  })

  test('Discover records submitted searches', async ({ page }) => {
    const searchEvents: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/search-events') {
        searchEvents.push(request.postData() ?? '')
      }
    })

    await page.goto('/discover')
    await page.getByPlaceholder(/search artists or albums/i).fill('U2')
    await page.getByPlaceholder(/search artists or albums/i).press('Enter')
    await expect(page).toHaveURL(/\/search\?q=U2/i)
    expect(searchEvents).toContain(JSON.stringify({ query: 'U2' }))
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
