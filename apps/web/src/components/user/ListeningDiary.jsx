import { memo, useMemo, useState } from 'react'

import { listeningDiary } from '../../services/ratingInsights.js'

const LEVELS = ['bg-white/[0.06]', 'bg-paper/25', 'bg-paper/50', 'bg-paper/75', 'bg-paper']
// Narrow screens show the last half year so each day stays big enough to tap.
const PHONE_WEEKS = 26
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short' })
const dayFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

const ratingsLabel = (count) => (count ? `${count} ${count === 1 ? 'rating' : 'ratings'}` : 'No ratings')

const ListeningDiary = ({ ratings }) => {
  const { weeks, total, activeDays, longestStreak } = useMemo(() => listeningDiary(ratings), [ratings])
  const [hovered, setHovered] = useState(null)
  const [pinned, setPinned] = useState(null)
  const today = weeks.at(-1)?.at(-1)
  const active = hovered ?? pinned

  // One delegated handler for ~370 cells; each cell carries its week and day position.
  // The tooltip is placed over the cell, measured against the grid it is positioned in.
  const dayAt = (event) => {
    const { week, day } = event.target.dataset ?? {}
    if (week === undefined) return null
    const grid = event.currentTarget.getBoundingClientRect()
    const cell = event.target.getBoundingClientRect()
    return {
      entry: weeks[week][day],
      x: cell.left - grid.left + cell.width / 2,
      y: cell.top - grid.top,
      side: (cell.left - grid.left) / grid.width,
    }
  }

  const figures = [
    { label: 'Active days', value: activeDays },
    { label: 'Longest streak', value: longestStreak },
  ]

  return (
    <section className="mt-24 grid gap-6 md:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="font-display text-3xl leading-none text-paper tablet:text-4xl">Listening Diary</h2>
        <p className="mt-2 text-sm text-muted">
          {total === 1 ? '1 record' : `${total} records`} rated in the past year.
        </p>
        <dl className="mt-6 flex gap-8">
          {figures.map((figure) => (
            <div key={figure.label} className="flex flex-col-reverse gap-1">
              <dt className="text-xs text-muted">{figure.label}</dt>
              <dd className="font-display text-4xl leading-none text-paper">{figure.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="min-w-0">
        <div
          role="img"
          aria-label={`${total} ratings across ${activeDays} days in the past year`}
          className="relative flex gap-[3px]"
          onPointerOver={(event) => {
            // Gaps and month labels keep the last day, so the tooltip doesn't flicker between cells.
            const day = event.pointerType === 'mouse' && dayAt(event)
            if (day) setHovered(day)
          }}
          onPointerLeave={() => setHovered(null)}
          onClick={(event) => {
            const day = dayAt(event)
            if (day) setPinned((current) => (current?.entry === day.entry ? null : day))
          }}
        >
          {active && (
            <span
              aria-hidden="true"
              style={{
                left: active.x,
                top: active.y - 8,
                transform: `translate(${active.side < 0.15 ? '-12px' : active.side > 0.85 ? 'calc(-100% + 12px)' : '-50%'}, -100%)`,
              }}
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-white/10 bg-[#161614] px-2.5 py-1.5 text-xs text-muted shadow-panel"
            >
              <span className="text-paper">{ratingsLabel(active.entry.count)}</span>
              {active.entry === today ? ' today' : ` on ${dayFormat.format(active.entry.date)}`}
            </span>
          )}
          {weeks.map((week, weekIndex) => (
            <div
              key={week[0].date.getTime()}
              className={`min-w-0 flex-1 flex-col gap-[3px] ${weekIndex < weeks.length - PHONE_WEEKS ? 'hidden tablet:flex' : 'flex'}`}
            >
              <span className="h-4 whitespace-nowrap text-[10px] leading-none text-muted">
                {week[0].date.getDate() <= 7 && weekIndex < weeks.length - 2 ? monthFormat.format(week[0].date) : ''}
              </span>
              {week.map((entry, dayIndex) => (
                <span
                  key={dayIndex}
                  data-week={weekIndex}
                  data-day={dayIndex}
                  className={`aspect-square w-full cursor-pointer rounded-[3px] transition-shadow ${LEVELS[Math.min(entry.count, 4)]} ${
                    entry === active?.entry ? 'ring-1 ring-inset ring-paper' : entry === today ? 'ring-1 ring-inset ring-paper/40' : ''
                  }`}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end text-muted">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="mr-1">Less</span>
            {LEVELS.map((level) => (
              <span key={level} className={`h-2.5 w-2.5 rounded-[2px] ${level}`} />
            ))}
            <span className="ml-1">More</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default memo(ListeningDiary)
