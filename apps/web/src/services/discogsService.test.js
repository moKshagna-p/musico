import test from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient } from '@tanstack/react-query'

import api from './apiClient.js'
import { getHomeSections, getReleaseDetails, updateAlbumCommunityStatsInCache } from './discogsService.js'
import { homeSectionsQueryOptions, updateHomeSectionsCommunityStats } from '../queries/homeSections.js'

const album = {
  id: 'm:1',
  name: 'Album',
  artists: ['Artist'],
  cover: null,
  releaseYear: 2025,
}

test('re-fetches home sections after a partial failure', async () => {
  const originalAdapter = api.defaults.adapter
  let calls = 0
  api.defaults.adapter = async (config) => {
    calls += 1
    return {
      data: calls === 1
        ? {
            mostHappening: { data: [], error: 'Unable to load most happening albums.' },
            recentReleases: { data: [album], error: null },
          }
        : {
            mostHappening: { data: [album], error: null },
            recentReleases: { data: [album], error: null },
          },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }

  try {
    await getHomeSections()
    const result = await getHomeSections()
    assert.equal(calls, 2)
    assert.deepEqual(result.mostHappening.data, [album])

    updateAlbumCommunityStatsInCache({ albumId: album.id, communityRating: 4.5, reviewCount: 2 })
    const cached = await getHomeSections()
    assert.equal(calls, 2)
    assert.equal(cached.mostHappening.data[0].communityRating, 4.5)
    assert.equal(cached.recentReleases.data[0].reviewCount, 2)
  } finally {
    api.defaults.adapter = originalAdapter
  }
})

test('updates both visible homepage query sections after community stats change', async () => {
  const queryClient = new QueryClient()
  const otherAlbum = { ...album, id: 'm:2' }
  const original = {
    mostHappening: { data: [album, otherAlbum], error: null },
    recentReleases: { data: [album], error: null },
  }
  queryClient.setQueryData(homeSectionsQueryOptions.queryKey, original)

  await updateHomeSectionsCommunityStats(queryClient, {
    albumId: album.id,
    communityRating: 4.5,
    reviewCount: 2,
  })

  const updated = queryClient.getQueryData(homeSectionsQueryOptions.queryKey)
  assert.equal(updated.mostHappening.data[0].communityRating, 4.5)
  assert.equal(updated.recentReleases.data[0].reviewCount, 2)
  assert.deepEqual(updated.mostHappening.data[1], otherAlbum)
  assert.equal(original.mostHappening.data[0].communityRating, undefined)
})

test('an in-flight Home fetch restarts without overwriting saved community stats', async () => {
  const queryClient = new QueryClient()
  const original = {
    mostHappening: { data: [album], error: null },
    recentReleases: { data: [album], error: null },
  }
  const refreshed = {
    mostHappening: { data: [album], error: null },
    recentReleases: { data: [album, { ...album, id: 'm:2' }], error: null },
  }
  queryClient.setQueryData(homeSectionsQueryOptions.queryKey, original)

  let resolveFetch
  let fetchStarted
  let fetches = 0
  const started = new Promise((resolve) => { fetchStarted = resolve })
  const fetch = queryClient.fetchQuery({
    queryKey: homeSectionsQueryOptions.queryKey,
    queryFn: ({ signal }) => {
      void signal.aborted
      fetches += 1
      if (fetches === 1) {
        fetchStarted()
        return new Promise((resolve) => { resolveFetch = resolve })
      }
      return refreshed
    },
  })

  await started
  await updateHomeSectionsCommunityStats(queryClient, {
    albumId: album.id,
    communityRating: 4.5,
    reviewCount: 2,
  })
  resolveFetch(original)
  await fetch.catch(() => {})

  const current = queryClient.getQueryData(homeSectionsQueryOptions.queryKey)
  assert.equal(fetches, 2)
  assert.equal(current.mostHappening.data[0].communityRating, 4.5)
  assert.equal(current.recentReleases.data[0].reviewCount, 2)
  assert.equal(current.recentReleases.data[1].id, 'm:2')
})

test('a cancelled Home request does not replace the patched service cache', async () => {
  const originalAdapter = api.defaults.adapter
  const originalNow = Date.now
  const controller = new AbortController()
  let now = originalNow() + 6 * 60 * 1000
  let resolveRequest
  const response = (config) => ({
    data: {
      mostHappening: { data: [album], error: null },
      recentReleases: { data: [album], error: null },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })

  try {
    Date.now = () => now
    api.defaults.adapter = async (config) => response(config)
    await getHomeSections()

    now += 6 * 60 * 1000
    api.defaults.adapter = (config) => new Promise((resolve) => {
      resolveRequest = () => resolve(response(config))
    })
    const request = getHomeSections({ signal: controller.signal })
    updateAlbumCommunityStatsInCache({ albumId: album.id, communityRating: 4.5, reviewCount: 2 })
    controller.abort()
    resolveRequest()
    await assert.rejects(request)

    now -= 6 * 60 * 1000
    const cached = await getHomeSections()
    assert.equal(cached.mostHappening.data[0].communityRating, 4.5)
    assert.equal(cached.recentReleases.data[0].reviewCount, 2)
  } finally {
    Date.now = originalNow
    api.defaults.adapter = originalAdapter
  }
})


test('release scores bypass a persisted cache across visits', async () => {
  const originalAdapter = api.defaults.adapter
  const originalStorage = globalThis.localStorage
  let calls = 0
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ timestamp: Date.now(), data: { ...album, communityRating: 1 } }),
    setItem: () => {},
  }
  api.defaults.adapter = async (config) => ({
    data: { ...album, communityRating: ++calls === 1 ? 4 : 4.5 },
    status: 200, statusText: 'OK', headers: {}, config,
  })
  try {
    assert.equal((await getReleaseDetails(album.id)).communityRating, 4)
    assert.equal((await getReleaseDetails(album.id)).communityRating, 4.5)
    assert.equal(calls, 2)
  } finally {
    api.defaults.adapter = originalAdapter
    globalThis.localStorage = originalStorage
  }
})
