import { memo, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FaStar } from 'react-icons/fa'

const RatingStars = ({ value = 0, onRate, readOnly = false, showValue = false }) => {
  const MotionButton = motion.button
  const [hoverValue, setHoverValue] = useState(null)
  const displayValue = hoverValue ?? value ?? 0

  const stars = useMemo(() => [1, 2, 3, 4, 5], [])

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <div className="flex items-center gap-1">
        {stars.map((star) => {
          const active = displayValue >= star
          return (
            <MotionButton
              key={star}
              type="button"
              aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
              disabled={readOnly}
              whileTap={{ scale: 0.9 }}
              whileHover={!readOnly ? { scale: 1.08 } : undefined}
              onClick={(event) => {
                event.stopPropagation()
                if (!readOnly) onRate?.(star)
              }}
              onMouseEnter={() => !readOnly && setHoverValue(star)}
              onMouseLeave={() => !readOnly && setHoverValue(null)}
              className={`rounded p-1 ${
                readOnly
                  ? 'cursor-default'
                  : 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
              }`}
            >
              <FaStar aria-hidden="true" className={`text-xl transition ${active ? 'text-white' : 'text-muted/45'}`} />
            </MotionButton>
          )
        })}
      </div>
      {showValue && (
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          {displayValue ? `${displayValue.toFixed(1)} / 5` : 'Rate'}
        </p>
      )}
    </div>
  )
}

export default memo(RatingStars)
