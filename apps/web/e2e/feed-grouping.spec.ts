import { expect, test } from '@playwright/test'
import { installApiMocks } from './support/mockApi'

const minute = 60_000
// A fixed afternoon, so every item lands under Today wherever the suite runs.
const now = new Date(2026, 9, 29, 18).getTime()
const jonas = { name: 'Jonas', username: 'jonass', image: null }
const mo = { name: 'Mo', username: 'mokshagna', image: null }
const entry = (id: string, user: typeof jonas, type: string, minutesAgo: number, extra = {}) => ({
  id, userId: user.username, user, type, targetUserId: null, albumCover: '', metadata: {}, createdAt: now - minutesAgo * minute, ...extra,
})
const album = (albumId: string, albumName: string) => ({ albumId, albumName })

test('a burst of activity collapses into one card under a day heading', async ({ page }) => {
  await page.clock.setFixedTime(now)
  await installApiMocks(page)
  await page.route('**/api/me/feed**', route => route.fulfill({
    json: {
      data: [
        entry('1', jonas, 'followed', 3, { targetUser: mo }),
        entry('2', jonas, 'rated', 6, { ...album('tod', 'Teens Of Denial'), metadata: { rating: 3.5 } }),
        entry('3', jonas, 'listed', 6, { ...album('tod', 'Teens Of Denial'), metadata: { listId: 'c', listName: 'comfort' } }),
        entry('4', jonas, 'listed', 6, { ...album('tf', 'Twin Fantasy'), metadata: { listId: 'c', listName: 'comfort' } }),
        entry('5', jonas, 'rated', 7, { ...album('tf', 'Twin Fantasy'), metadata: { rating: 3.5 } }),
        entry('6', mo, 'reviewed', 15, { ...album('dbd', "Don't Be Dumb"), metadata: { snippet: 'Loud and messy in the best way.' } }),
        ...['a', 'b', 'c', 'd', 'e'].map((id, i) => entry(`m${id}`, mo, 'rated', 120 + i, { ...album(id, `Record ${id.toUpperCase()}`), metadata: { rating: 4 } })),
        entry('7', mo, 'rated', 300, { ...album('tf', 'Twin Fantasy'), metadata: { rating: 5 } }),
      ],
      nextCursor: null,
    },
  }))
  await page.goto('/auth')
  await page.getByLabel(/email/i).fill('e2e@musico.dev')
  await page.getByLabel(/password/i).fill('password123')
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/feed')

  const today = page.getByRole('region', { name: 'Today' })
  await expect(today.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(today.getByRole('article')).toHaveCount(4)

  const jonasCard = today.getByRole('article').first()
  await expect(jonasCard.getByRole('link', { name: 'Teens Of Denial' })).toHaveCount(1)
  await expect(jonasCard.getByLabel('Rated 3.5 out of 5 stars')).toHaveCount(2)
  await expect(jonasCard.getByRole('link', { name: 'comfort' })).toHaveCount(2)
  await expect(jonasCard.getByText('Started following mokshagna')).toBeVisible()

  await expect(today.getByText('Loud and messy in the best way.')).toBeVisible()

  const burst = today.getByRole('article').nth(2)
  await expect(burst.getByRole('listitem')).toHaveCount(3)
  await burst.getByRole('button', { name: 'Show 2 more' }).click()
  await expect(burst.getByRole('listitem')).toHaveCount(5)

  const circle = page.getByRole('region', { name: 'Lately in your circle' })
  await expect(circle.getByRole('link', { name: /Twin Fantasy\s*2 people/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Most active' }).getByRole('link', { name: 'mokshagna' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(circle).toBeHidden()
  await expect(page.getByLabel('Search for users')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
