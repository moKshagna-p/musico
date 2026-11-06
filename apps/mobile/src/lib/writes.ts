// Writes for one key (an album) run one at a time in the order they were made, so the server ends on the last
// choice. Only the newest write's outcome is "current": an older write finishing late, or failing, must not
// override what the person picked after it.
export type QueuedResult<T> = { ok: true; value: T; current: boolean } | { ok: false; error: unknown; current: boolean }

export class CancelledWrite extends Error {
  constructor() {
    super('The account that made this change is no longer signed in.')
  }
}

// `stillValid` is checked when a queued write is about to start and again when it finishes: a change made by one
// account must never be sent with, or applied to, the session of whoever signed in after it.
export const createWriteQueue = () => {
  const tails = new Map<string, Promise<unknown>>()
  const newest = new Map<string, number>()
  let counter = 0

  return <T>(key: string, write: () => Promise<T>, stillValid: () => boolean = () => true): Promise<QueuedResult<T>> => {
    const id = ++counter
    newest.set(key, id)
    const run = (tails.get(key) ?? Promise.resolve()).then(() => {
      if (!stillValid()) throw new CancelledWrite()
      return write()
    })
    // The chain continues past failures; each caller still sees its own outcome.
    tails.set(key, run.catch(() => {}))
    return run.then(
      (value) => ({ ok: true as const, value, current: newest.get(key) === id && stillValid() }),
      (error) => ({ ok: false as const, error, current: newest.get(key) === id && stillValid() }),
    )
  }
}
