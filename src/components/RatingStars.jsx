import { memo, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FaStar } from 'react-icons/fa'

const RatingStars = ({ value = 0, onRate, readOnly = false, showValue = false }) => {
  const [hoverValue, setHoverValue] = useState(null)
  const displayValue = hoverValue ?? value ?? 0

  const stars = useMemo(() => [1, 2, 3, 4, 5], [])

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <div className="flex items-center gap-1">
        {stars.map((star) => {
          const active = displayValue >= star
          return (
            <motion.button
              key={star}
              type="button"
              disabled={readOnly}
              whileTap={{ scale: 0.9 }}
              whileHover={!readOnly ? { scale: 1.08 } : undefined}
              onClick={() => !readOnly && onRate?.(star)}
              onMouseEnter={() => !readOnly && setHoverValue(star)}
              onMouseLeave={() => !readOnly && setHoverValue(null)}
              className={`p-1 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <FaStar className={`text-xl transition ${active ? 'text-white' : 'text-muted/45'}`} />
            </motion.button>
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
