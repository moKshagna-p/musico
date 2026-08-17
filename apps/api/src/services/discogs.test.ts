import { expect, test } from 'bun:test'

Bun.env.DISCOGS_MIN_REQUEST_INTERVAL_MS = '1'
Bun.env.DISCOGS_MAX_RETRIES = '1'
Bun.env.DISCOGS_REQUEST_TIMEOUT_MS = '10'

const { buildSmartSearchResults, isDiscogsCacheFresh, normalizeSearchValue, requestDiscogs } = await import('./discogs')

test('rejects Discogs cache data at the six-hour ceiling', () => {
  expect(isDiscogsCacheFresh(new Date())).toBe(true)
  expect(isDiscogsCacheFresh(new Date(Date.now() - 1000 * 60 * 60 * 6))).toBe(false)
})

test('retries a transient Discogs network failure', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    if (calls === 1) throw new Error('network unavailable')
    return new Response(JSON.stringify({ results: [] }))
  }

  try {
    await expect(requestDiscogs('/database/search')).resolves.toEqual({ results: [] })
    expect(calls).toBe(2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('does not retry a non-retryable Discogs response', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response('invalid request', { status: 400 })
  }

  try {
    await expect(requestDiscogs('/database/search')).rejects.toThrow('400')
    expect(calls).toBe(1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('aborts a stalled Discogs request', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (_, init) => {
    calls += 1
    return new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    })
  }

  try {
    await expect(requestDiscogs('/database/search')).rejects.toThrow()
    expect(calls).toBe(2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('keeps Unicode letters searchable', () => {
  expect(normalizeSearchValue('宇多田ヒカル')).toBe('宇多田ヒカル')
})

test('ranks an exact artist and album match above a more popular partial result', () => {
  const result = buildSmartSearchResults(
    [
      { id: 'm:partial', name: 'Discovery Live', artists: ['Different Artist'], popularity: 10000, reviewCount: 1000 },
      { id: 'm:exact', name: 'Discovery', artists: ['Daft Punk'], popularity: 1, reviewCount: 0 },
    ],
    'Daft Punk Discovery',
  )

  expect(result.data[0]?.id).toBe('m:exact')
})
