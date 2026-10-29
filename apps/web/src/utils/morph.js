import { flushSync } from 'react-dom'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const canMorph = () => Boolean(document.startViewTransition) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Flying to or from something off screen just looks like a glitch; those fall back to the page crossfade.
const onScreen = (element) => {
  const rect = element.getBoundingClientRect()
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth
}

// Runs `update` inside a View Transition so `from` (an element on screen now) morphs into whatever `to()`
// returns once the update has rendered, e.g. an album card's cover into the album page's sleeve.
// The name is only set on each element for its own snapshot, so a grid of tiles never shares it at once.
// Browsers without View Transitions, and people who prefer reduced motion, get the plain update.
export const morph = (update, { from, to, name }) => {
  if (!canMorph()) {
    update()
    return
  }
  const named = from && onScreen(from) ? from : null
  if (named) named.style.viewTransitionName = name
  const transition = document.startViewTransition(async () => {
    if (named) named.style.viewTransitionName = ''
    flushSync(update)
    // A lazy page suspends for a moment before its target mounts; the old frame holds until then (or ~200ms).
    let target = to()
    for (let tries = 0; !target && tries < 12; tries += 1) {
      await wait(16)
      target = to()
    }
    if (!target || !onScreen(target)) return
    target.style.viewTransitionName = name
    transition.finished.finally(() => { target.style.viewTransitionName = '' })
  })
}

// The album page's sleeve, and the cover that opens album `id` on the page underneath: an album card's sleeve, or the
// cover inside any link to it (profile tiles, lists, history, the feed).
const albumPageSleeve = () => document.querySelector('[data-album-cover] [data-sleeve]')
const coverFor = (id) => {
  const href = CSS.escape(`/album/${id}`)
  return document.querySelector(
    `[data-album-card="${CSS.escape(id)}"] [data-sleeve], a[href="${href}"] [data-sleeve], a[href="${href}"] img`,
  )
}

// Album covers fly between their tile and the album page both ways. Album cards morph on their own click; every
// other link to an album with a cover in it is caught here, so new tiles get it for free. Back and forward (browser
// buttons, swipe gestures, the album page's back button) can't be wrapped like a click either: the browser fires
// popstate and React Router re-renders right away. In both cases, hold the event, start the transition while the old
// page is still on screen, and replay the event inside it. Installed before the router mounts, so these listeners
// run first.
export const installAlbumMorphs = () => {
  // The app restores scroll itself (App.jsx); the browser doing it too would move the page before the snapshot.
  window.history.scrollRestoration = 'manual'
  let replaying = false

  document.addEventListener(
    'click',
    (event) => {
      if (replaying || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target.closest?.('a[href^="/album/"]')
      const from = link?.querySelector('[data-sleeve], img')
      if (!from || !canMorph()) return
      event.preventDefault()
      event.stopPropagation()
      morph(
        () => {
          replaying = true
          link.click()
          replaying = false
        },
        { from, to: albumPageSleeve, name: 'album-cover' },
      )
    },
    true,
  )

  window.addEventListener('popstate', (event) => {
    const albumCover = document.querySelector('[data-album-cover]')
    const from = albumPageSleeve()
    // Safari and Chrome on Android animate swipe-back themselves; a second animation on top would stutter.
    if (replaying || !from || event.hasUAVisualTransition || !canMorph()) return
    event.stopImmediatePropagation()
    morph(
      () => {
        replaying = true
        window.dispatchEvent(new PopStateEvent('popstate', { state: event.state }))
        replaying = false
      },
      {
        from,
        to: () => {
          const cover = coverFor(albumCover.dataset.albumCover)
          // Horizontal rows remount scrolled to the start; bring the cover you opened back into view.
          cover?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
          return cover
        },
        name: 'album-cover',
      },
    )
  })
}
