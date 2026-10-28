import { expect, test } from '@playwright/test'

import { albumCatalog, installApiMocks } from './support/mockApi'

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

  test('sign-up requires an available username and the feed addresses the user by it', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('button', { name: 'Create Account' }).click()
    await page.getByLabel('Email').fill('new@musico.dev')
    await page.getByLabel('Password').fill('password123')

    await page.getByLabel('Username').fill('Taken-Name')
    await expect(page.getByText('Already taken')).toBeVisible()
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click()
    await expect(page.getByText('Pick an available username.')).toBeVisible()

    await page.getByLabel('Username').fill('vinyl-fan')
    await expect(page.getByText('Available', { exact: true })).toBeVisible()
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click()
    await expect(page).toHaveURL('/')

    await page.getByRole('link', { name: 'Feed', exact: true }).click()
    await expect(page.getByRole('link', { name: 'vinyl-fan', exact: true })).toHaveAttribute('href', '/profile/vinyl-fan')
  })

  test('late username checks cannot overwrite the current name and typing is debounced', async ({ page }) => {
    let releaseOld: () => void = () => {}
    const oldHeld = new Promise<void>((resolve) => { releaseOld = resolve })
    const checked: string[] = []
    await page.route('**/api/username/check?*', async (route) => {
      const name = new URL(route.request().url()).searchParams.get('username') ?? ''
      checked.push(name)
      if (name === 'alice') await oldHeld
      await route.fulfill({ json: { data: { valid: true, available: name !== 'alice' } } })
    })
    await page.goto('/auth')
    await page.getByRole('button', { name: 'Create Account' }).click()
    await page.getByLabel('Email').fill('new@musico.dev')
    await page.getByLabel('Password').fill('password123')
    const input = page.getByLabel('Username')
    await input.fill('ab')
    await expect(page.getByText('3-24 chars, lowercase letters, numbers, hyphens')).toBeVisible()
    await input.fill('alice')
    await expect.poll(() => checked).toEqual(['alice'])
    await input.fill('alicea')
    await input.fill('alicia')
    await expect(page.getByText('Available', { exact: true })).toBeVisible()
    releaseOld()
    await page.waitForTimeout(450)
    await expect(page.getByText('Available', { exact: true })).toBeVisible()
    expect(checked).toEqual(['alice', 'alicia'])
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click()
    await expect(page).toHaveURL('/')
  })

  for (const flow of ['sign-up', 'username setup']) {
    test(`${flow} can retry a failed username check without changing the input`, async ({ page }) => {
      let attempts = 0
      await page.route('**/api/username/check?*', async (route) => {
        attempts += 1
        await route.fulfill(attempts <= 2
          ? { status: 503, json: { error: 'Temporarily unavailable' } }
          : { json: { data: { valid: true, available: true } } })
      })
      if (flow === 'sign-up') {
        await page.goto('/auth')
        await page.getByRole('button', { name: 'Create Account' }).click()
      } else {
        await signIn(page)
        await page.route('**/api/me/dashboard', async (route) => {
          await route.fulfill({ json: {
            ratings: {}, recentRatings: [], lists: [],
            profile: { username: null, name: 'E2E User', bio: '' },
          } })
        })
        await page.goto('/profile')
        await expect(page.getByRole('heading', { name: 'Choose your username' })).toBeVisible()
      }
      await page.getByLabel('Username', { exact: true }).fill('vinyl-fan')
      await expect(page.getByText('Unable to check username. Please retry.')).toBeVisible()
      await page.getByRole('button', { name: 'Retry username check' }).click()
      await expect(page.getByText('Available', { exact: true })).toBeVisible()
      expect(attempts).toBe(3)
      if (flow === 'username setup') {
        await page.locator('form').getByRole('button', { name: 'Set Username' }).click()
        await expect(page.getByRole('heading', { name: 'Choose your username' })).toHaveCount(0)
      } else {
        await page.getByLabel('Email').fill('new@musico.dev')
        await page.getByLabel('Password').fill('password123')
        await page.locator('form').getByRole('button', { name: 'Create Account' }).click()
        await expect(page).toHaveURL('/')
      }
    })
  }

  test('profile editing waits for saved fields and later refreshes preserve active drafts', async ({ page }) => {
    let profile = {
      userId: 'user-e2e', username: 'e2e-user', name: 'E2E User', bio: 'Saved bio',
      image: 'http://localhost:4000/api/avatars/user-e2e?v=1',
      cover: 'http://localhost:4000/api/covers/user-e2e?v=1' as string | null,
    }
    const saves: Array<{ bio: string; image: string; cover?: string }> = []
    let dashboardRequests = 0
    let releaseInitial: () => void = () => {}
    let releaseRefresh: () => void = () => {}
    const initialHeld = new Promise<void>((resolve) => { releaseInitial = resolve })
    const refreshHeld = new Promise<void>((resolve) => { releaseRefresh = resolve })
    await page.route('**/api/me/dashboard', async (route) => {
      dashboardRequests += 1
      if (dashboardRequests === 1) await initialHeld
      if (dashboardRequests === 2) await refreshHeld
      await route.fulfill({ json: { ratings: {}, recentRatings: [], lists: [], profile } })
    })
    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      const payload = route.request().postDataJSON()
      saves.push(payload)
      const cover = payload.cover === undefined ? profile.cover : payload.cover
        ? 'http://localhost:4000/api/covers/user-e2e?v=2' : null
      profile = { ...profile, ...payload, cover }
      await route.fulfill({ json: { data: profile } })
    })
    await signIn(page)
    await page.goto('/profile')
    await expect.poll(() => dashboardRequests).toBe(1)
    const editButton = page.getByRole('button', { name: 'Edit Profile' })
    await expect(editButton).toBeDisabled()
    await expect(page.getByRole('heading', { name: 'Edit Profile' })).toHaveCount(0)
    releaseInitial()
    await expect(editButton).toBeEnabled()
    await editButton.click()
    await expect(page.getByLabel('Bio', { exact: true })).toHaveValue('Saved bio')
    const modal = page.getByRole('heading', { name: 'Edit Profile' }).locator('..')
    await expect(modal.locator('img[src*="/api/avatars/user-e2e"]')).toHaveAttribute('src', profile.image)
    await expect(modal.locator('img[src*="/api/covers/user-e2e"]')).toHaveAttribute('src', profile.cover!)

    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 2
      return canvas.toDataURL('image/png').split(',')[1]
    })
    await page.route('**/api/avatars/**', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }))
    await page.route('**/api/covers/**', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }))
    await page.getByLabel('Bio', { exact: true }).fill('First change')
    await modal.locator('button').filter({ hasText: /^Remove$/ }).last().click()
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect.poll(() => dashboardRequests).toBe(2)
    await expect(editButton).toBeEnabled()
    await page.getByLabel('Bio', { exact: true }).fill('New draft during refresh')
    await page.locator('input[type="file"]').nth(1).setInputFiles({
      name: 'new-cover.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
    })
    const coverPreview = modal.locator('img[src^="data:image/jpeg;base64,"]')
    await expect(coverPreview).toHaveCount(1)
    const newCover = await coverPreview.getAttribute('src')
    releaseRefresh()
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    await expect(page.getByLabel('Bio', { exact: true })).toHaveValue('New draft during refresh')
    await expect(coverPreview).toHaveAttribute('src', newCover!)
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect.poll(() => saves.length).toBe(2)
    expect(saves[0]).toMatchObject({ bio: 'First change', image: 'http://localhost:4000/api/avatars/user-e2e?v=1', cover: '' })
    expect(saves[1]).toMatchObject({ bio: 'New draft during refresh', cover: newCover })
  })

  test('cover save waits for the latest conversion and ignores removed or cancelled choices', async ({ page }) => {
    await page.addInitScript(() => {
      const createBitmap = window.createImageBitmap.bind(window)
      window['coverConversions'] = {}
      window.createImageBitmap = async (file: File) => {
        await new Promise<void>((resolve, reject) => { window['coverConversions'][file.name] = { resolve, reject } })
        return createBitmap(file)
      }
    })
    const saves: Array<{ cover?: string }> = []
    const savedCoverUrl = 'http://localhost:4000/api/covers/user-e2e?v=1'
    let storedCover: string | null = null
    await page.route('**/api/me/dashboard', (route) => route.fulfill({ json: {
      ratings: {}, recentRatings: [], lists: [],
      profile: { userId: 'user-e2e', username: 'e2e-user', name: 'E2E User', bio: 'E2E profile', image: null, cover: storedCover },
    } }))
    let finishSave: () => void = () => {}
    const saveHeld = new Promise<void>((resolve) => { finishSave = resolve })
    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      const payload = route.request().postDataJSON()
      saves.push(payload)
      await saveHeld
      if (payload.cover !== undefined) storedCover = payload.cover ? savedCoverUrl : null
      await route.fulfill({ json: { data: { ...payload, cover: storedCover } } })
    })
    await signIn(page)
    await page.goto('/profile')
    await page.getByRole('button', { name: 'Edit Profile' }).click()
    const colors = await page.evaluate(() => ['red', 'blue'].map((color) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 2
      const context = canvas.getContext('2d')!
      context.fillStyle = color
      context.fillRect(0, 0, 2, 2)
      return canvas.toDataURL('image/png').split(',')[1]
    }))
    const choose = async (name: string, color = 0) => {
      await page.locator('input[type="file"]').nth(1).setInputFiles({
        name, mimeType: 'image/png', buffer: Buffer.from(colors[color], 'base64'),
      })
      await expect.poll(() => page.evaluate((key) => Boolean(window['coverConversions'][key]), name)).toBe(true)
    }
    const finish = async (name: string, fail = false) => {
      await page.evaluate(({ key, fail }) => {
        window['coverConversions'][key][fail ? 'reject' : 'resolve']()
      }, { key: name, fail })
    }
    const preview = page.locator('img.aspect-\\[3\\/1\\]')
    await choose('old.png')
    await expect(page.getByRole('button', { name: 'Preparing cover...' })).toBeDisabled()
    expect(saves).toEqual([])
    await choose('latest.png', 1)
    await finish('latest.png')
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    const latestPreview = await preview.getAttribute('src')
    await finish('old.png')
    await page.waitForTimeout(100)
    await expect(preview).toHaveAttribute('src', latestPreview!)

    await choose('removed.png')
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    await finish('removed.png')
    await page.waitForTimeout(100)
    await expect(preview).toHaveCount(0)

    await choose('cancelled.png')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: 'Edit Profile' }).click()
    await finish('cancelled.png')
    await page.waitForTimeout(100)
    await expect(preview).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()

    await choose('failed.png')
    await finish('failed.png', true)
    await expect(page.getByText('Unable to read that image.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    await choose('saved.png', 1)
    await finish('saved.png')
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect.poll(() => saves.length).toBe(1)
    expect(saves[0].cover).toBe(latestPreview)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: 'Edit Profile' }).click()
    await page.getByLabel('Bio', { exact: true }).fill('Keep this newer draft')
    finishSave()
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    await page.waitForTimeout(650)
    await expect(page.getByRole('heading', { name: 'Edit Profile' })).toBeVisible()
    await expect(page.getByLabel('Bio', { exact: true })).toHaveValue('Keep this newer draft')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect.poll(() => saves.length).toBe(2)
    expect(saves[1]).not.toHaveProperty('cover')
    expect(storedCover).toBe(savedCoverUrl)
  })

  test('bio edits after navigating during a pending cover upload do not delete the cover', async ({ page }) => {
    const saves: Array<{ bio: string; cover?: string }> = []
    const savedCoverUrl = 'http://localhost:4000/api/covers/user-e2e?v=123'
    let storedCover: string | null = null
    await page.route('**/api/me/dashboard', (route) => route.fulfill({ json: {
      ratings: {}, recentRatings: [], lists: [],
      profile: { userId: 'user-e2e', username: 'e2e-user', name: 'E2E User', bio: 'E2E profile', image: null, cover: storedCover },
    } }))
    let releaseUpload: () => void = () => {}
    const uploadHeld = new Promise<void>((resolve) => { releaseUpload = resolve })
    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      const payload = route.request().postDataJSON()
      saves.push(payload)
      if (saves.length === 1) await uploadHeld
      if (payload.cover !== undefined) storedCover = payload.cover ? savedCoverUrl : null
      await route.fulfill({ json: { data: { ...payload, cover: storedCover } } })
    })
    await signIn(page)
    await page.goto('/profile')
    await page.getByRole('button', { name: 'Edit Profile' }).click()
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 2
      return canvas.toDataURL('image/png').split(',')[1]
    })
    await page.route('**/api/covers/**', (route) => route.fulfill({
      contentType: 'image/png', body: Buffer.from(png, 'base64'),
    }))
    await page.locator('input[type="file"]').nth(1).setInputFiles({
      name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
    })
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect.poll(() => saves.length).toBe(1)
    expect(saves[0].cover).toMatch(/^data:image\/jpeg;base64,/)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('link', { name: 'Home', exact: true }).click()
    await expect(page.getByRole('heading', { name: /most happening right now/i })).toBeVisible()
    await page.getByRole('link', { name: 'Profile', exact: true }).click()
    await page.getByRole('button', { name: 'Edit Profile' }).click()
    await page.getByLabel('Bio', { exact: true }).fill('New draft on the remounted profile')
    releaseUpload()
    await expect(page.locator('img[decoding="async"][src*="/api/covers/user-e2e"]')).toHaveAttribute('src', savedCoverUrl)
    await expect(page.getByLabel('Bio', { exact: true })).toHaveValue('New draft on the remounted profile')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect.poll(() => saves.length).toBe(2)
    expect(saves[1]).not.toHaveProperty('cover')
    expect(storedCover).toBe(savedCoverUrl)
  })

  test('an older upload response cannot replace a newer cover saved after navigation', async ({ page }) => {
    let profile = { userId: 'user-e2e', username: 'e2e-user', name: 'E2E User', bio: '', image: null, cover: null as string | null }
    let version = 0
    let releaseFirst: () => void = () => {}
    const firstHeld = new Promise<void>((resolve) => { releaseFirst = resolve })
    await page.route('**/api/me/dashboard', (route) => route.fulfill({ json: {
      ratings: {}, recentRatings: [], lists: [], profile,
    } }))
    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      const payload = route.request().postDataJSON()
      profile = { ...profile, ...payload, cover: `http://localhost:4000/api/covers/user-e2e?v=${++version}` }
      // The server write completes now; each response retains its own saved version.
      const saved = { ...profile }
      if (version === 1) await firstHeld
      await route.fulfill({ json: { data: saved } })
    })
    await signIn(page)
    await page.goto('/profile')
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 2
      return canvas.toDataURL('image/png').split(',')[1]
    })
    await page.route('**/api/covers/**', (route) => route.fulfill({
      contentType: 'image/png', body: Buffer.from(png, 'base64'),
    }))
    const saveCover = async () => {
      await page.getByRole('button', { name: 'Edit Profile' }).click()
      await page.locator('input[type="file"]').nth(1).setInputFiles({
        name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
      })
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
      await page.getByRole('button', { name: 'Save Changes' }).click()
    }
    const revisit = async () => {
      await page.getByRole('link', { name: 'Home', exact: true }).click()
      await expect(page.getByRole('heading', { name: /most happening right now/i })).toBeVisible()
      await page.getByRole('link', { name: 'Profile', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'E2E User' })).toBeVisible()
    }
    await saveCover()
    await expect.poll(() => version).toBe(1)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await revisit()
    await saveCover()
    await expect(page.getByRole('heading', { name: 'Edit Profile' })).toHaveCount(0)
    const latestCover = profile.cover!
    const backdrop = page.locator('img[decoding="async"][src*="/api/covers/user-e2e"]')
    await expect(backdrop).toHaveAttribute('src', latestCover)
    const firstResponse = page.waitForResponse(async (response) =>
      new URL(response.url()).pathname === '/api/me/profile' && (await response.json()).data.cover.endsWith('?v=1'))
    releaseFirst()
    await (await firstResponse).finished()
    await revisit()
    expect(profile.cover).toBe(latestCover)
    await expect(backdrop).toHaveAttribute('src', latestCover)
  })

  test('saved covers survive cached profile navigation and later bio edits, replacement, and removal', async ({ page }) => {
    let profile = {
      id: 'profile-e2e', userId: 'user-e2e', username: 'e2e-user', bio: 'Original bio',
      name: 'E2E User', image: null as string | null, cover: null as string | null,
      followerCount: 7, followingCount: 3,
    }
    let version = 0
    let dashboardRequests = 0
    let rejectNextSave = false
    let rejectedPayload: { cover?: string } | null = null
    const saves: Array<{ bio: string; cover?: string }> = []
    await page.route('**/api/me/dashboard', async (route) => {
      dashboardRequests += 1
      await route.fulfill({ json: {
        ratings: {}, ratingSummary: { totalRated: 0, averageRating: 0 }, recentRatings: [], lists: [], profile,
      } })
    })
    await page.route('**/api/me/profile', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      const payload = route.request().postDataJSON()
      if (rejectNextSave) {
        rejectedPayload = payload
        rejectNextSave = false
        return route.fulfill({ status: 503, json: { error: 'Unable to save profile.' } })
      }
      saves.push(payload)
      const cover = payload.cover === undefined ? profile.cover : payload.cover.startsWith('data:')
        ? `http://localhost:4000/api/covers/user-e2e?v=${++version}`
        : payload.cover || null
      profile = { ...profile, ...payload, cover }
      // Match the save endpoint: name and follower counts come only from the dashboard.
      await route.fulfill({ json: { data: {
        username: profile.username, bio: profile.bio, image: profile.image, cover: profile.cover, isPublic: true,
      } } })
    })
    await signIn(page)
    await page.goto('/profile')
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 2
      return canvas.toDataURL('image/png').split(',')[1]
    })
    await page.route('**/api/covers/**', (route) => route.fulfill({
      contentType: 'image/png', body: Buffer.from(png, 'base64'),
    }))
    const uploadCover = async () => {
      await page.getByRole('button', { name: 'Edit Profile' }).click()
      await page.locator('input[type="file"]').nth(1).setInputFiles({
        name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
      })
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
      await page.getByRole('button', { name: 'Save Changes' }).click()
      await expect(page.getByRole('heading', { name: 'Edit Profile' })).toHaveCount(0)
    }
    const revisitProfile = async () => {
      await expect.poll(() => dashboardRequests).toBe(saves.length + 1)
      const requestsBeforeNavigation = dashboardRequests
      await page.getByRole('link', { name: 'Home', exact: true }).click()
      await expect(page.getByRole('heading', { name: /most happening right now/i })).toBeVisible()
      await page.getByRole('link', { name: 'Profile', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'E2E User' })).toBeVisible()
      expect(dashboardRequests).toBe(requestsBeforeNavigation)
    }
    const backdrop = page.locator('img[decoding="async"][src*="/api/covers/user-e2e"]')
    await uploadCover()
    const firstCover = profile.cover!
    await expect(backdrop).toHaveAttribute('src', firstCover)
    await revisitProfile()
    await expect(backdrop).toHaveAttribute('src', firstCover)
    await page.getByRole('button', { name: 'Edit Profile' }).click()
    await page.getByLabel('Bio', { exact: true }).fill('This edit fails')
    rejectNextSave = true
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText('Unable to save profile.')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await revisitProfile()
    await expect(backdrop).toHaveAttribute('src', firstCover)
    await page.getByRole('button', { name: 'Edit Profile' }).click()
    await expect(page.getByLabel('Bio', { exact: true })).toHaveValue('Original bio')
    await page.getByLabel('Bio', { exact: true }).fill('New bio, same cover')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Profile' })).toHaveCount(0)
    expect(saves[1]).toMatchObject({ bio: 'New bio, same cover' })
    expect(saves[1]).not.toHaveProperty('cover')
    expect(profile.cover).toBe(firstCover)

    await uploadCover()
    expect(profile.cover).not.toBe(firstCover)
    await revisitProfile()
    await expect(backdrop).toHaveAttribute('src', profile.cover!)
    await page.getByRole('button', { name: 'Edit Profile' }).click()
    await expect(page.getByLabel('Bio', { exact: true })).toHaveValue('New bio, same cover')
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    rejectNextSave = true
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText('Unable to save profile.')).toBeVisible()
    expect(rejectedPayload).toMatchObject({ cover: '' })
    await expect(backdrop).toHaveAttribute('src', profile.cover!)
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Profile' })).toHaveCount(0)
    expect(saves[3].cover).toBe('')
    await revisitProfile()
    await expect(backdrop).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit Profile' }).click()
    await page.getByLabel('Bio', { exact: true }).fill('Cover stays removed')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect.poll(() => saves.length).toBe(5)
    expect(saves[4]).not.toHaveProperty('cover')
    expect(profile.cover).toBeNull()
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

  test('album cards open details instantly while the tracklist loads', async ({ page }) => {
    let releaseTracks: () => void = () => {}
    const tracksHeld = new Promise<void>((resolve) => { releaseTracks = resolve })
    await page.route('**/api/releases/**', async (route) => {
      await tracksHeld
      await route.fallback()
    })

    await page.goto('/')
    await page.locator('article').filter({ hasText: 'Discovery' }).first().click()
    await expect(page).toHaveURL(/\/album\//)
    await expect(page.getByText('Community score')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Discovery' })).toBeVisible()
    await expect(page.getByTestId('track-number')).toHaveCount(0)

    releaseTracks()
    await expect(page.getByTestId('track-number').first()).toBeVisible()
  })

  test('list cards open the list instantly and load the remaining albums', async ({ page }) => {
    const albums = albumCatalog.slice(0, 2).concat(albumCatalog).slice(0, 5).map((album, index) => ({
      id: `${album.id}-${index}`, name: `${album.name} ${index + 1}`, cover: album.cover, artists: album.artists, releaseYear: album.releaseYear,
    }))
    await page.route('**/api/me/dashboard', (route) => route.fulfill({ json: {
      ratings: {}, ratingSummary: { totalRated: 0, averageRating: 0 }, recentRatings: [],
      profile: { id: 'profile-e2e', userId: 'user-e2e', username: 'e2e-user', bio: '', name: 'E2E User', image: null, followerCount: 0, followingCount: 0 },
      lists: [{ id: 'list-top', name: 'Top Albums', albums: albums.slice(0, 4), albumCount: 5 }],
    } }))
    let releaseList: () => void = () => {}
    const listHeld = new Promise<void>((resolve) => { releaseList = resolve })
    await page.route('**/api/lists/list-top', async (route) => {
      await listHeld
      await route.fulfill({ json: { data: { id: 'list-top', name: 'Top Albums', owner: { id: 'user-e2e', name: 'E2E User', username: 'e2e-user' }, albums } } })
    })

    await signIn(page)
    await page.goto('/profile')
    await page.getByRole('link', { name: /Top Albums/ }).click()
    await expect(page).toHaveURL('/lists/list-top')
    await expect(page.getByRole('heading', { level: 1, name: 'Top Albums' })).toBeVisible()
    await expect(page.getByText('5 albums')).toBeVisible()
    await expect(page.getByRole('heading', { name: albums[3].name })).toBeVisible()
    await expect(page.getByRole('heading', { name: albums[4].name })).toHaveCount(0)

    releaseList()
    await expect(page.getByRole('heading', { name: albums[4].name })).toBeVisible()
    await expect(page.getByText('A list by E2E User')).toBeVisible()
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

  test('an empty chart swaps the home hero placeholder for a way into discover', async ({ page }) => {
    await page.route('**/api/home*', (route) =>
      route.fulfill({ json: { mostHappening: { data: [], error: null }, recentReleases: { data: [], error: null } } }),
    )
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /dig through the vault/i })).toBeVisible()
    await page.getByRole('link', { name: /discover albums/i }).click()
    await expect(page).toHaveURL('/discover')
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

  test('unrated albums say so instead of showing a zero score', async ({ page }) => {
    await page.route(
      (url) => url.pathname === '/api/releases/m:1001',
      (route) => route.fulfill({ json: { ...albumCatalog[0], communityRating: 0, reviewCount: 0 } }),
    )
    await page.goto('/album/m:1001')
    await expect(page.getByText('No ratings yet')).toBeVisible()
    await expect(page.getByText('0.0')).toHaveCount(0)
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

  test('a signed-in page load fetches account data in one request alongside the session', async ({ page }) => {
    await signIn(page)
    const accountRequests: string[] = []
    let markBootstrapRequested: () => void = () => {}
    const bootstrapRequested = new Promise<void>((resolve) => { markBootstrapRequested = resolve })
    page.on('request', (request) => {
      const { pathname } = new URL(request.url())
      if (['/api/me/bootstrap', '/api/me/ratings', '/api/me/lists', '/api/admin/me'].includes(pathname)) accountRequests.push(pathname)
      if (pathname === '/api/me/bootstrap') markBootstrapRequested()
    })
    // Holding the session back until the bootstrap is requested proves it does not wait for get-session.
    await page.route('**/api/auth/get-session*', async (route) => {
      await bootstrapRequested
      await route.fallback()
    })

    await page.goto('/album/m:1001')
    await expect(page.getByRole('button', { name: /favorites/i })).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(accountRequests).toEqual(['/api/me/bootstrap'])
  })

  test('lists show their loading state until the account lists arrive', async ({ page }) => {
    await signIn(page)
    let releaseLists: (() => void) | undefined
    await page.route('**/api/me/bootstrap', async (route) => {
      await new Promise<void>((resolve) => { releaseLists = resolve })
      await route.fallback()
    })
    await page.goto('/album/m:1001')
    await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible()
    await expect(page.getByText('Loading your lists')).toBeVisible()
    releaseLists?.()
    await expect(page.getByRole('button', { name: /favorites/i })).toBeVisible()
  })

  test('a failed list load offers a retry instead of showing an empty account', async ({ page }) => {
    await signIn(page)
    // A failed bootstrap falls back to /me/lists, which fails once here.
    await page.route('**/api/me/bootstrap', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Unavailable"}' }))
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
