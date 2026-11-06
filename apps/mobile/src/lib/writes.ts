// Writes for one key (an album) run one at a time in the order they were made, so the server ends on the last
// choice. Only the newest write's outcome is "current": an older write finishing late, or failing, must not
// override what the person picked after it.
export type QueuedResult<T> = { ok: true; value: T; current: boolean } | { ok: false; error: unknown; current: boolean }

export const createWriteQueue = () => {
  const tails = new Map<string, Promise<unknown>>()
  const newest = new Map<string, number>()
  let counter = 0

  return <T>(key: string, write: () => Promise<T>): Promise<QueuedResult<T>> => {
    const id = ++counter
    newest.set(key, id)
    const run = (tails.get(key) ?? Promise.resolve()).then(write)
    // The chain continues past failures; each caller still sees its own outcome.
    tails.set(key, run.catch(() => {}))
    return run.then(
      (value) => ({ ok: true as const, value, current: newest.get(key) === id }),
      (error) => ({ ok: false as const, error, current: newest.get(key) === id }),
    )
  }
}
