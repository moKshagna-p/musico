import { memo, useMemo, useState } from 'react'
import { motion as Motion, useReducedMotion } from 'framer-motion'

import { ratingSpread } from '../../services/ratingInsights.js'

const LABELS = ['½', '1', '1½', '2', '2½', '3', '3½', '4', '4½', '5']
const stars = (index) => `${LABELS[index]} ${index > 1 ? 'stars' : 'star'}`

const verdictFor = (average) => {
  if (average >= 4) return 'Easy to please.'
  if (average >= 3) return 'Fair, but firm.'
  return 'Hard to impress.'
}

const RatingSpread = ({ ratings, averageRating }) => {
  const reducedMotion = useReducedMotion()
  const counts = useMemo(() => ratingSpread(ratings), [ratings])
  const total = counts.reduce((sum, count) => sum + count, 0)
  const max = Math.max(...counts)
  const mode = max ? counts.indexOf(max) : -1
  // Hover previews a bar on desktop; a tap pins it, which is how phones explore the chart.
  const [hovered, setHovered] = useState(null)
  const [pinned, setPinned] = useState(null)
  const active = hovered ?? pinned ?? mode

  let note = 'Rate a few albums to see how you score.'
  if (total && active === mode && pinned === null && hovered === null) note = `${verdictFor(averageRating)} Mostly ${stars(mode)}.`
  else if (total) {
    const count = counts[active]
    note = `${count} ${count === 1 ? 'album' : 'albums'} at ${stars(active)}, ${Math.round((count / total) * 100)}% of your ratings.`
  }

  return (
    <section className="my-14 grid gap-6 md:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="font-display text-3xl leading-none text-paper tablet:text-4xl">Rating Spread</h2>
        <p aria-live="polite" className="mt-2 min-h-10 text-sm text-muted md:min-h-0">{note}</p>
      </div>

      <div role="group" aria-label="Albums per rating" className="grid grid-cols-10 gap-1 sm:gap-2 tablet:gap-2.5" onMouseLeave={() => setHovered(null)}>
        {counts.map((count, index) => {
          const isActive = total > 0 && index === active
          return (
            <button
              key={LABELS[index]}
              type="button"
              disabled={!total}
              aria-label={`${stars(index)}: ${count} ${count === 1 ? 'album' : 'albums'}`}
              aria-pressed={pinned === index}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              onClick={() => setPinned((current) => (current === index ? null : index))}
              className="group flex min-w-0 flex-col items-center gap-2 rounded-md outline-none focus-visible:ring-1 focus-visible:ring-paper/50"
            >
              <span className={`h-4 text-xs tabular-nums transition-colors ${isActive ? 'text-paper' : 'text-transparent'}`}>{count}</span>
              <span className="flex h-32 w-full items-end border-b border-white/[0.07] tablet:h-36">
                <Motion.span
                  initial={reducedMotion ? false : { scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: max ? `${(count / max) * 100}%` : 0, originY: 1 }}
                  className={`block w-full rounded-t-[3px] transition-colors duration-200 ${isActive ? 'bg-paper' : 'bg-paper/20 group-hover:bg-paper/35'}`}
                />
              </span>
              <span className={`text-xs tabular-nums transition-colors ${isActive ? 'text-paper' : 'text-muted'}`}>{LABELS[index]}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default memo(RatingSpread)
