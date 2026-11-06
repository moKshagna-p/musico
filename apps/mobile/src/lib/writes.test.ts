import { describe, expect, test } from 'bun:test'

import { EMPTY_DRAFT, toDraft } from './reviewDraft'
import { CancelledWrite, createWriteQueue } from './writes'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createWriteQueue', () => {
  test('runs one album at a time, in tap order, and only the newest result is current', async () => {
    const queue = createWriteQueue()
    const started: number[] = []
    const four = deferred<number>()
    const first = queue('album', () => {
      started.push(4)
      return four.promise
    })
    const second = queue('album', async () => {
      started.push(5)
      return 5
    })
    // The 5-star write waits for the 4-star one, so the server can't end on the older value.
    await Promise.resolve()
    expect(started).toEqual([4])
    four.resolve(4)
    expect(await first).toEqual({ ok: true, value: 4, current: false })
    expect(await second).toEqual({ ok: true, value: 5, current: true })
    expect(started).toEqual([4, 5])
  })

  test('an older failure is not current, so it cannot roll back a newer choice', async () => {
    const queue = createWriteQueue()
    const first = queue('album', () => Promise.reject(new Error('offline')))
    const second = queue('album', async () => 'saved')
    expect((await first).current).toBe(false)
    expect(await second).toEqual({ ok: true, value: 'saved', current: true })
  })

  test('the newest failure is current, and different albums do not wait on each other', async () => {
    const queue = createWriteQueue()
    const slow = deferred<string>()
    const a = queue('a', () => slow.promise)
    const b = await queue('b', () => Promise.reject(new Error('nope')))
    expect(b.ok).toBe(false)
    expect(b.current).toBe(true)
    slow.resolve('done')
    expect((await a).current).toBe(true)
  })
})

describe('account changes', () => {
  test('a write queued by one account never runs once another account is signed in, and nothing is applied', async () => {
    const queue = createWriteQueue()
    let account = 'a'
    const slow = deferred<string>()
    const sent: string[] = []
    const first = queue('album', () => slow.promise, () => account === 'a')
    const second = queue('album', async () => {
      sent.push('second')
      return 'saved'
    }, () => account === 'a')
    account = 'b'
    slow.resolve('done')
    const [one, two] = await Promise.all([first, second])
    expect(sent).toEqual([])
    expect(one.current).toBe(false)
    expect(two.ok).toBe(false)
    expect(two.ok ? null : two.error).toBeInstanceOf(CancelledWrite)
    expect(two.current).toBe(false)
  })
})

describe('toDraft', () => {
  test('no saved review starts empty', () => {
    expect(toDraft(null)).toBe(EMPTY_DRAFT)
  })

  test('a saved review keeps its text and its uploaded images, so updating does not drop them', () => {
    const draft = toDraft({
      content: 'Stayed with me',
      media: [
        { id: 'img1', kind: 'image', url: 'https://x/1.jpg', width: 800, height: 600 },
        { id: 'img2', kind: 'image', url: 'https://x/2.jpg' },
      ],
    })
    expect(draft.content).toBe('Stayed with me')
    expect(draft.gif).toBeNull()
    expect(draft.images.map((image) => [image.id, image.status, image.width])).toEqual([
      ['img1', 'done', 800],
      ['img2', 'done', 1],
    ])
  })

  test('a saved GIF comes back as the picked GIF', () => {
    const draft = toDraft({ content: '', media: [{ id: 'g', kind: 'gif', url: 'https://x/a.gif', width: 200, height: 100, alt: 'dance' }] })
    expect(draft.images).toEqual([])
    expect(draft.gif).toEqual({ id: 'g', url: 'https://x/a.gif', preview: 'https://x/a.gif', width: 200, height: 100, title: 'dance' })
  })
})
