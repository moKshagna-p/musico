import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { homeSectionsQueryOptions } from '../../queries/homeSections.js'

// A record you can spin, in the spirit of the iPod click wheel on Apple Music's 404 page.
// Drag it around (or flick it) and every STEP degrees of turning drops the next album's label on the platter.
// Grooves look the same at any angle, so only the label rotates and the sheen stays put like real light.
const STEP = 60
const IDLE_SPEED = 15 // deg/s, the old 24s-per-turn drift
const FRICTION = 2.2 // per second; how fast a flick settles back to the drift
const MAX_SPEED = 1440
const ALBUM_COUNT = 12

const wrap = (value, count) => ((value % count) + count) % count

const SpinVinyl = () => {
  const reduceMotion = useReducedMotion()
  const { data } = useQuery(homeSectionsQueryOptions)
  const albums = (data?.mostHappening?.data ?? []).slice(0, ALBUM_COUNT)
  const count = albums.length

  const platterRef = useRef(null)
  const labelRef = useRef(null)
  // angle: where the label is drawn. dialed: only the turning the visitor did, which picks the album,
  // so the idle drift never swaps labels while someone is typing their password.
  const spin = useRef({ angle: 0, dialed: 0, velocity: 0, dragging: false, pointer: 0, time: 0 })
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let frame
    let previous = performance.now()
    const tick = (now) => {
      const dt = Math.min((now - previous) / 1000, 0.05)
      previous = now
      const state = spin.current
      if (!state.dragging) {
        const idle = reduceMotion ? 0 : IDLE_SPEED
        state.velocity = idle + (state.velocity - idle) * Math.exp(-dt * FRICTION)
        state.angle += state.velocity * dt
        // A flick's extra speed keeps dialing; easing back up to the drift after a stop does not.
        const excess = state.velocity - idle
        if (Math.sign(excess) === Math.sign(state.velocity)) state.dialed += excess * dt
      }
      if (labelRef.current) labelRef.current.style.transform = `rotate(${state.angle}deg)`
      if (count) setIndex(wrap(Math.floor(state.dialed / STEP), count))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [count, reduceMotion])

  // Warm the neighbours so a fast spin doesn't flash empty labels.
  useEffect(() => {
    if (!count) return
    for (const offset of [-1, 1, 2]) {
      const album = albums[wrap(index + offset, count)]
      for (const src of [album.cover, album.discLabel]) if (src) new Image().src = src
    }
  }, [albums, count, index])

  const pointerAngle = (event) => {
    const rect = platterRef.current.getBoundingClientRect()
    return (Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2) * 180) / Math.PI
  }

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    Object.assign(spin.current, { dragging: true, velocity: 0, pointer: pointerAngle(event), time: event.timeStamp })
  }

  const handlePointerMove = (event) => {
    const state = spin.current
    if (!state.dragging) return
    const current = pointerAngle(event)
    const delta = wrap(current - state.pointer + 180, 360) - 180
    const seconds = (event.timeStamp - state.time) / 1000
    state.angle += delta
    state.dialed += delta
    if (seconds > 0) state.velocity = 0.6 * (delta / seconds) + 0.4 * state.velocity
    state.pointer = current
    state.time = event.timeStamp
  }

  const handlePointerUp = (event) => {
    const state = spin.current
    state.dragging = false
    // Holding still before letting go means no flick.
    const held = event.timeStamp - state.time > 80
    state.velocity = held ? 0 : Math.max(-MAX_SPEED, Math.min(MAX_SPEED, state.velocity))
  }

  const handleKeyDown = (event) => {
    const direction = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key]
    if (!direction) return
    event.preventDefault()
    const state = spin.current
    state.dialed = (Math.floor(state.dialed / STEP) + direction + 0.5) * STEP
    state.angle += direction * STEP
  }

  const album = albums[index]

  return (
    <div className="mx-auto w-[85%]">
      <div
        ref={platterRef}
        role="slider"
        tabIndex={0}
        aria-label="Spin the record to browse albums"
        aria-valuemin={1}
        aria-valuemax={Math.max(count, 1)}
        aria-valuenow={index + 1}
        aria-valuetext={album ? `${album.name} by ${album.artists?.[0] ?? 'Unknown artist'}` : 'musico'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="vinyl relative aspect-square cursor-grab touch-none select-none rounded-full active:cursor-grabbing focus-visible:outline-offset-8"
      >
        {/* Label photos load slowly from the Cover Art Archive; the cover (usually cached from Home) shows until it paints. */}
        <div
          ref={labelRef}
          style={album?.cover ? { backgroundImage: `url(${album.cover})` } : undefined}
          className="absolute inset-[33%] overflow-hidden rounded-full bg-paper bg-cover bg-center ring-1 ring-black"
        >
          {album ? (
            album.discLabel && <img key={album.discLabel} src={album.discLabel} alt="" draggable={false} decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="absolute left-1/2 top-[22%] -translate-x-1/2 font-display text-2xl text-black">musico</span>
          )}
          <span className="absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted/70">Give it a spin</p>
        <p className="mt-2 h-6 truncate text-paper">
          {album && (
            <Link to={`/album/${album.id}`} className="hover:underline">
              {album.name}
              <span className="text-muted"> · {album.artists?.[0]}</span>
            </Link>
          )}
        </p>
      </div>
    </div>
  )
}

export default SpinVinyl
