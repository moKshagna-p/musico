import { expect, test, type Page } from '@playwright/test'

import { albumCatalog, installApiMocks } from './support/mockApi'

const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

const signIn = async (page: Page) => {
  await page.goto('/auth')
  await page.getByLabel(/email/i).fill('e2e@musico.dev')
  await page.getByLabel(/password/i).fill('password123')
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL('/')
}

// Records whether any page skeleton shows from now on, even for a single frame.
const watchForSkeletons = (page: Page) => page.evaluate(() => {
  const seen: string[] = []
  ;(window as unknown as { skeletonsSeen: string[] }).skeletonsSeen = seen
  new MutationObserver(() => {
    document.querySelectorAll('[aria-busy="true"][aria-label^="Loading"]').forEach((node) => seen.push(node.getAttribute('aria-label') ?? ''))
  }).observe(document.body, { childList: true, subtree: true })
})
const skeletonsSeen = (page: Page) => page.evaluate(() => (window as unknown as { skeletonsSeen: string[] }).skeletonsSeen)

test('moving between someone else\'s profile, their albums and lists never flashes a skeleton', async ({ page }) => {
  await installApiMocks(page)
  const listAlbums = albumCatalog.map(({ id, name, cover, artists, releaseYear }) => ({ id, name, cover, artists, releaseYear }))
  const list = { id: 'list-ava', name: 'Late Night', albums: listAlbums, albumCount: listAlbums.length }
  let profileRequests = 0
  await page.route('**/api/users/ava', (route) => {
    profileRequests += 1
    return route.fulfill({ json: { data: {
      userId: 'ava', username: 'ava', name: 'Ava', bio: '', image: null, cover: null,
      followerCount: 3, followingCount: 2, isFollowing: false, isOwnProfile: false, isPrivate: false,
      recentRatings: [{ albumId: 'm:1001', rating: 4.5, timestamp: Date.now(), albumName: 'Discovery', albumCover: albumCatalog[0].cover, albumArtists: ['Daft Punk'] }],
      lists: [list],
    } } })
  })
  await page.route('**/api/lists/list-ava', (route) => route.fulfill({ json: { data: { ...list, owner: { id: 'ava', name: 'Ava', username: 'ava' } } } }))

  await page.goto('/profile/ava')
  await expect(page.getByRole('heading', { level: 1, name: 'Ava' })).toBeVisible()
  // Let the idle preload fetch the album and list pages' code, as it does for anyone who lingers on a page.
  await page.waitForTimeout(2500)
  await watchForSkeletons(page)

  await page.getByRole('link', { name: /Discovery/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Discovery' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Ava' })).toBeVisible()

  await page.getByRole('link', { name: /Late Night/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Late Night' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Ava' })).toBeVisible()

  expect(await skeletonsSeen(page)).toEqual([])
  expect(profileRequests).toBe(1)
})

test('your recent top artist shows as their logo when there is one', async ({ page }) => {
  await installApiMocks(page)
  await page.route('**/api/me/dashboard', (route) => route.fulfill({ json: {
    ratings: {}, ratingSummary: { totalRated: 2, averageRating: 4 }, lists: [],
    recentRatings: albumCatalog.slice(0, 2).map((album) => ({
      albumId: album.id, rating: 4, timestamp: Date.now(), albumName: album.name, albumCover: album.cover, albumArtists: album.artists,
    })),
    profile: { username: 'e2e-user', name: 'E2E User' },
  } }))
  await page.route('**/api/artist-logo?*', (route) => route.fulfill({ json: { logo: 'https://r2.theaudiodb.com/images/media/artist/logo/daft-punk.png' } }))
  await page.route('**/api/artist-logo/image?*', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG }))

  await signIn(page)
  await page.goto('/profile')
  const topArtist = page.locator('div').filter({ has: page.getByText('Recent top artist', { exact: true }) }).last()
  await expect(topArtist.getByRole('img', { name: 'Daft Punk' })).toBeVisible()
})

test('a profile cached before sign-in uses the signed-in follow state', async ({ page }) => {
  await installApiMocks(page)
  let signedIn = false
  let profileRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/auth/sign-in')) signedIn = true
  })
  await page.route('**/api/users/ava', (route) => {
    profileRequests += 1
    return route.fulfill({ json: { data: {
      userId: 'ava', username: 'ava', name: 'Ava', followerCount: 3, followingCount: 2,
      isFollowing: signedIn, isOwnProfile: false, recentRatings: [], lists: [],
    } } })
  })
  await page.goto('/profile/ava')
  await expect(page.getByRole('heading', { name: 'Ava', exact: true })).toBeVisible()
  await page.getByRole('banner').getByRole('link', { name: 'Sign In' }).click()
  // Sign in without reloading the app, so the anonymous profile remains cached.
  await page.getByLabel(/email/i).fill('e2e@musico.dev')
  await page.getByLabel(/password/i).fill('password123')
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL('/')
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Ava', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unfollow ava', exact: true })).toBeVisible()
  expect(profileRequests).toBe(2)
})

test('following from a mixed-case profile URL refreshes the follower count', async ({ page }) => {
  await installApiMocks(page)
  let following = false
  await page.route('**/api/users/AVA', (route) => route.fulfill({ json: { data: {
    userId: 'ava', username: 'ava', name: 'Ava', followerCount: following ? 4 : 3, followingCount: 2,
    isFollowing: following, isOwnProfile: false, recentRatings: [], lists: [],
  } } }))
  await page.route('**/api/users/ava/follow', (route) => {
    following = !following
    return route.fulfill({ json: { data: { following } } })
  })
  await signIn(page)
  await page.goto('/profile/AVA')
  await expect(page.getByText('3 followers', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Follow ava', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unfollow ava', exact: true })).toBeVisible()
  await expect(page.getByText('4 followers', { exact: true })).toBeVisible()
})
