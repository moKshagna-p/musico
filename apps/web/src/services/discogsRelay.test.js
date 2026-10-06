import { test } from 'node:test'
import assert from 'node:assert/strict'
import handler from '../../api/discogs.js'

const invoke = async (url, { secret = 'relay-secret', authorization = 'Bearer relay-secret', method = 'GET', fetcher } = {}) => {
  const response = { headers: {}, setHeader(k,v) { this.headers[k] = v }, status(code) { this.statusCode = code; return this }, send(body) { this.body = body; return this }, json(body) { this.body = body; return this } }
  await handler({ url, method, headers: { authorization, 'x-discogs-authorization': 'Discogs token=private-token' } }, response, { secret, fetcher })
  return response
}

test('relay rejects unauthenticated requests and fails closed when unconfigured', async () => {
  const fetcher = () => { throw new Error('must not fetch') }
  assert.equal((await invoke('/api/discogs?path=/masters/1', { authorization: 'Bearer wrong', fetcher })).statusCode, 401)
  assert.equal((await invoke('/api/discogs?path=/masters/1', { secret: '', fetcher })).statusCode, 503)
  assert.equal((await invoke('/api/discogs?path=/masters/1', { method: 'POST', fetcher })).statusCode, 405)
})

test('relay cannot target other hosts, paths, redirects, or unsupported query parameters', async () => {
  for (const path of ['https://example.com/', '//example.com', '/masters/../1', '/users/me', '/masters/1/extra']) {
    const response = await invoke('/api/discogs?path=' + encodeURIComponent(path), { fetcher: () => { throw new Error('must not fetch') } })
    assert.equal(response.statusCode, 400, path)
  }
  assert.equal((await invoke('/api/discogs?path=/masters/1&token=leaked', { fetcher: () => { throw new Error('must not fetch') } })).statusCode, 400)
})

test('relay forwards public catalog requests and preserves upstream rate limit responses', async () => {
  let received
  const response = await invoke('/api/discogs?path=/database/search&q=lil%20uzi&type=master&page=1&per_page=50', { fetcher: async (url, options) => {
    received = { url: String(url), options }
    return new Response('busy', { status: 429, headers: { 'retry-after': '60', 'x-discogs-ratelimit-remaining': '0', 'set-cookie': 'private' } })
  } })
  assert.equal(received.url, 'https://api.discogs.com/database/search?q=lil+uzi&type=master&page=1&per_page=50')
  assert.equal(received.options.headers.Authorization, 'Discogs token=private-token')
  assert.equal(received.options.redirect, 'error')
  assert.equal(response.statusCode, 429)
  assert.equal(response.body, 'busy')
  assert.equal(response.headers['retry-after'], '60')
  assert.equal(response.headers['set-cookie'], undefined)
  assert.equal(response.headers['Cache-Control'], 'no-store')
})

test('relay contains provider failures without exposing credentials', async () => {
  const response = await invoke('/api/discogs?path=/releases/1', { fetcher: async () => { throw new Error('private-token') } })
  assert.equal(response.statusCode, 502)
  assert.deepEqual(response.body, { error: 'Discogs is temporarily unavailable.' })
})
