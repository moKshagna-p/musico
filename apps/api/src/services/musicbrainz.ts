import { env } from '../core/env'
import { isServicePaused, pauseService } from '../core/sharedCache'

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

const MB_GAP_MS = 1100
const RATE_LIMIT_BACKOFF_MS = 1000 * 60 * 10
// shortcut: request spacing is per isolate; add a shared slot if shared backoff keeps recurring.
let nextMbSlot = 0
let backoffUntil = 0

export const mbJson = async (url: string, fetcher: Fetcher, timeoutMs = 15000) => {
  const request = async () => {
    const wait = nextMbSlot - Date.now()
    nextMbSlot = Math.max(Date.now(), nextMbSlot) + MB_GAP_MS
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    if (Date.now() < backoffUntil || await isServicePaused('musicbrainz')) throw new Error('MusicBrainz is rate limited')
    const response = await fetcher(url, {
      headers: { 'User-Agent': env.DISCOGS_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (response.status === 404) return null
    if (!response.ok) throw Object.assign(new Error(`${new URL(url).host} returned ${response.status}`), { status: response.status })
    return response.json()
  }

  try {
    // MusicBrainz answers 503 while busy; keep the existing single retry in the next slot.
    return await request().catch((error) => {
      if ((error as { status?: number }).status === 503) return request()
      throw error
    })
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 429 || status === 503) {
      backoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS
      await pauseService('musicbrainz', RATE_LIMIT_BACKOFF_MS)
    }
    throw error
  }
}
