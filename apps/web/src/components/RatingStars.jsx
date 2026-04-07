import { memo, useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaStar } from 'react-icons/fa'

const RatingStars = ({ value = 0, onRate, readOnly = false, showValue = false }) => {
  const MotionButton = motion.button
  const MotionSpan = motion.span
  const MotionDiv = motion.div
  const [hoverValue, setHoverValue] = useState(null)
  const [lastRated, setLastRated] = useState(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const displayValue = hoverValue ?? value ?? 0

  const stars = useMemo(() => [1, 2, 3, 4, 5], [])

  // Hide confirmation after a delay
  useEffect(() => {
    if (showConfirmation) {
      const timer = setTimeout(() => setShowConfirmation(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [showConfirmation])

  const handleRate = (star) => {
    if (readOnly) return
    setLastRated(star)
    setShowConfirmation(true)
    onRate?.(star)
  }

  return (
    <div className="relative flex flex-col items-end gap-1 text-right">
      <div className="flex items-center gap-1">
        {stars.map((star) => {
          const active = displayValue >= star
          const isRecentlySelected = lastRated === star && showConfirmation

          return (
            <MotionButton
              key={star}
              type="button"
              aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
              disabled={readOnly}
              whileTap={{ scale: 0.85 }}
              whileHover={!readOnly ? { scale: 1.15 } : undefined}
              onClick={(event) => {
                event.stopPropagation()
                handleRate(star)
              }}
              onMouseEnter={() => !readOnly && setHoverValue(star)}
              onMouseLeave={() => !readOnly && setHoverValue(null)}
              className={`relative rounded p-1 transition-colors duration-200 ${
                readOnly
                  ? 'cursor-default'
                  : 'cursor-pointer focus-visible:outline-none'
              }`}
            >
              {/* Ripple Effect (Matching Site Vibe) */}
              <AnimatePresence>
                {isRecentlySelected && (
                  <MotionSpan
                    initial={{ scale: 0.5, opacity: 0.8 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="absolute inset-0 z-0 rounded-full bg-white/30"
                  />
                )}
              </AnimatePresence>

              <FaStar 
                aria-hidden="true" 
                className={`relative z-10 text-xl transition-all duration-300 ${
                  active ? 'scale-110 text-white' : 'text-muted/45'
                } ${isRecentlySelected ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : ''}`} 
              />
            </MotionButton>
          )
        })}
      </div>

      <AnimatePresence>
        {showConfirmation && (
          <MotionDiv
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -20 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute -top-4 right-0 pointer-events-none"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
              Recorded
            </span>
          </MotionDiv>
        )}
      </AnimatePresence>

      {showValue && (
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          {displayValue ? `${displayValue.toFixed(1)} / 5` : 'Rate'}
        </p>
      )}
    </div>
  )
}

export default memo(RatingStars)
