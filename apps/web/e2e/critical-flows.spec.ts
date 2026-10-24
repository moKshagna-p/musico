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
    await expect(page.getByRole('heading', { name: /most happening right now/i })).toBeVisible()

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

  test('feed names open profiles, prefetched on hover and cached for revisits', async ({ page }) => {
    let profileRequests = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/users/e2e-user') profileRequests += 1
    })

    await signIn(page)
    await page.getByRole('link', { name: 'Feed', exact: true }).click()
    const actor = page.getByRole('link', { name: 'E2E User', exact: true })
    await actor.hover()
    await expect.poll(() => profileRequests).toBe(1)

    await actor.click()
    await expect(page).toHaveURL('/profile/e2e-user')
    await expect(page.getByRole('heading', { name: 'E2E User' })).toBeVisible()
    await expect(page.getByText('3 followers')).toBeVisible()

    await page.goBack()
    await page.goForward()
    await expect(page.getByRole('heading', { name: 'E2E User' })).toBeVisible()
    await expect(page.getByLabel('Loading profile')).toHaveCount(0)
    expect(profileRequests).toBe(1)
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

  test('search follows browser history and keeps earlier results visible while loading more', async ({ page }) => {
    await page.goto('/search?q=pagination')
    await expect(page.getByText('Pagination Album 12')).toBeVisible()

    let releaseNextPage: (() => void) | undefined
    await page.route('**/api/search?*', async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('q') === 'pagination' && url.searchParams.get('offset') === '12') {
        await new Promise<void>((resolve) => { releaseNextPage = resolve })
      }
      await route.fallback()
    })

    const nextPageRequest = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return url.pathname === '/api/search' && url.searchParams.get('q') === 'pagination' && url.searchParams.get('offset') === '12'
    })
    await page.getByRole('button', { name: /load more/i }).click()
    await nextPageRequest
    await expect(page.getByRole('heading', { name: 'Pagination Album 1', exact: true })).toBeVisible()
    releaseNextPage?.()
    await expect(page.getByText('Pagination Album 13')).toBeVisible()

    await page.getByPlaceholder(/search music/i).fill('U2')
    await page.getByPlaceholder(/search music/i).press('Enter')
    await expect(page).toHaveURL('/search?q=U2')
    await expect(page.getByRole('heading', { name: 'U2', exact: true })).toBeVisible()
    await expect(page.locator('article').filter({ hasText: 'U2' })).toHaveCount(1)

    await page.goBack()
    await expect(page).toHaveURL('/search?q=pagination')
    await expect(page.getByRole('heading', { name: '“pagination”' })).toBeVisible()
    await expect(page.getByText('Pagination Album 13')).toBeVisible()
  })

  test('a failed next search page keeps results and can be retried', async ({ page }) => {
    let nextPageAttempts = 0
    await page.route('**/api/search?*', async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('q') === 'pagination' && url.searchParams.get('offset') === '12') {
        nextPageAttempts += 1
        if (nextPageAttempts <= 2) {
          await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Catalog temporarily unavailable"}' })
          return
        }
      }
      await route.fallback()
    })

    await page.goto('/search?q=pagination')
    await expect(page.getByRole('heading', { name: 'Pagination Album 1', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Load More' }).click()
    await expect(page.getByRole('alert')).toContainText('Catalog temporarily unavailable')
    await expect(page.getByRole('heading', { name: 'Pagination Album 1', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Retry Load More' }).click()
    await expect(page.getByText('Pagination Album 13')).toBeVisible()
  })

  test('album cards can be opened with the keyboard without speculative detail requests', async ({ page }) => {
    const detailRequests: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/releases/')) detailRequests.push(request.url())
    })

    await page.goto('/')
    const card = page.locator('article').filter({ hasText: 'Discovery' }).first()
    await card.hover()
    await page.waitForTimeout(700)
    expect(detailRequests).toHaveLength(0)

    await card.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/album\/m:1001$/)
  })

  test('home and discover controls render while album sections load', async ({ page }) => {
    let releaseHome: (() => void) | undefined
    let releaseFeatured: (() => void) | undefined
    await page.route('**/api/home*', async (route) => {
      await new Promise<void>((resolve) => { releaseHome = resolve })
      await route.fallback()
    })
    await page.route('**/api/featured*', async (route) => {
      await new Promise<void>((resolve) => { releaseFeatured = resolve })
      await route.fallback()
    })

    const homeRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/home')
    await page.goto('/')
    await homeRequest
    await expect(page.getByRole('heading', { name: /most happening right now/i })).toBeVisible()
    releaseHome?.()

    const featuredRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/featured')
    await page.goto('/discover')
    await featuredRequest
    await expect(page.getByRole('heading', { name: /dig through the vault/i })).toBeVisible()
    await expect(page.getByPlaceholder(/search artists or albums/i)).toBeVisible()
    releaseFeatured?.()
    await expect(page.locator('article').filter({ hasText: 'Discovery' }).first()).toBeVisible()
  })

  test('predictive search does not offer results from a previous term', async ({ page }) => {
    await page.goto('/discover')
    const search = page.getByPlaceholder(/search artists or albums/i)
    await search.fill('daft punk')
    await expect(page.getByRole('button', { name: /Discovery.*Daft Punk/i })).toBeVisible()

    await search.fill('beatles')
    expect(await page.getByRole('button', { name: /Discovery.*Daft Punk/i }).count()).toBe(0)
  })

  test('recent searches can be reopened with the keyboard', async ({ page }) => {
    await page.goto('/search?q=pagination')
    const search = page.getByPlaceholder(/search music/i)
    await search.fill('U2')
    await search.press('Enter')
    await expect(page).toHaveURL('/search?q=U2')
    await search.fill('daft punk')
    await search.press('Enter')
    await expect(page).toHaveURL('/search?q=daft+punk')

    await search.fill('')
    const recentSearch = page.getByRole('button', { name: 'Search U2' })
    await recentSearch.focus()
    // Keyboard users can pause after moving focus into the history dropdown.
    await page.waitForTimeout(350)
    await expect(recentSearch).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/search?q=U2')
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

  test('guests cannot fetch or see album reviews', async ({ page }) => {
    let reviewRequests = 0
    await page.route('**/api/albums/*/reviews*', async (route) => {
      reviewRequests += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'private-review', content: 'Private review text', user: { name: 'Someone' }, createdAt: Date.now() }] }),
      })
    })

    await page.goto('/album/m:1001')
    await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible()
    await expect(page.getByText('Sign in to read and write reviews.')).toBeVisible()
    expect(reviewRequests).toBe(0)
    await expect(page.getByText('Private review text')).toHaveCount(0)
  })

  test('album track durations line up in a fixed column', async ({ page }) => {
    await page.goto('/album/m:1001')
    await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible()
    const durations = page.getByTestId('track-duration')
    await expect(durations).toHaveCount(3)
    const positions = await durations.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().left))
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2)
  })

  test('vinyl side numbers do not restart the displayed track sequence', async ({ page }) => {
    await page.route('**/api/releases/m:1001', async (route) => {
      await route.fulfill({ json: {
        id: 'm:1001', name: 'Discovery', artists: ['Daft Punk'],
        tracks: [
          { id: 'a1', name: 'One More Time', track_number: 1 },
          { id: 'a2', name: 'Aerodynamic', track_number: 2 },
          { id: 'b1', name: 'Digital Love', track_number: 1 },
        ],
      } })
    })
    await page.goto('/album/m:1001')
    await expect(page.getByTestId('track-number')).toHaveText(['1', '2', '3'])
    await expect(page.getByRole('link', { name: 'Spotify', exact: true }).first()).toHaveAttribute('href', 'https://open.spotify.com/search/Daft%20Punk%20Discovery')
  })

  test('lists show their loading state until the account lists arrive', async ({ page }) => {
    let releaseLists: (() => void) | undefined
    await page.route('**/api/me/lists', async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise<void>((resolve) => { releaseLists = resolve })
      }
      await route.fallback()
    })
    await signIn(page)
    await page.goto('/album/m:1001')
    await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible()
    await expect(page.getByText('Loading your lists')).toBeVisible()
    releaseLists?.()
    await expect(page.getByRole('button', { name: /favorites/i })).toBeVisible()
  })

  test('a failed list load offers a retry instead of showing an empty account', async ({ page }) => {
    await signIn(page)
    let attempts = 0
    await page.route('**/api/me/lists', async (route) => {
      if (route.request().method() === 'GET') {
        attempts += 1
        if (attempts === 1) {
          await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Lists unavailable"}' })
          return
        }
      }
      await route.fallback()
    })

    await page.goto('/album/m:1001')
    await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry loading lists' })).toBeVisible()
    await page.getByRole('button', { name: 'Retry loading lists' }).click()
    await expect(page.getByRole('button', { name: /favorites/i })).toBeVisible()
    expect(attempts).toBe(2)
  })
})
