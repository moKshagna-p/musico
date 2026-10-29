// TheAudioDB's free key allows 30 requests a minute and answers 429 past that, asking callers to wait a minute.
// While it rests, callers fall back to fanart.tv.

import { isServicePaused, pauseService } from '../core/sharedCache'

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

const REQUEST_TIMEOUT_MS = 6000
const RATE_LIMIT_REST_MS = 60 * 1000

// The local flag skips the database read while this isolate already knows; the shared pause tells the others.
let restUntil = 0

export const audioDbJson = async (path: string, key: string, fetcher: Fetcher) => {
  if (Date.now() < restUntil || await isServicePaused('theaudiodb')) throw new Error('TheAudioDB is rate limited')
  const response = await fetcher(`https://www.theaudiodb.com/api/v1/json/${encodeURIComponent(key)}/${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (response.status === 429) {
    restUntil = Date.now() + RATE_LIMIT_REST_MS
    await pauseService('theaudiodb', RATE_LIMIT_REST_MS)
  }
  if (!response.ok) throw new Error(`TheAudioDB returned ${response.status}`)
  return response.json()
}

export const resetAudioDbRest = () => { restUntil = 0 }
