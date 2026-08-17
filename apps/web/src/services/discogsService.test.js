import test from 'node:test'
import assert from 'node:assert/strict'

import api from './apiClient.js'
import { getHomeSections } from './discogsService.js'

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
  } finally {
    api.defaults.adapter = originalAdapter
  }
})
