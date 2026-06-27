import { memo, useState, useEffect } from 'react'
import { FaStar } from 'react-icons/fa'

const STAR_VALUES = [1, 2, 3, 4, 5]

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-xl',
}

const clampRating = (value) => {
  const numericValue = Number(value ?? 0)
  if (!Number.isFinite(numericValue)) return 0
  return Math.min(5, Math.max(0, Math.round(numericValue * 2) / 2))
}

const RatingStars = ({ value = 0, onRate, readOnly = false, showValue = false, size = 'md', align = 'right' }) => {
  const [hoverValue, setHoverValue] = useState(null)
  const [lastRated, setLastRated] = useState(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmationLabel, setConfirmationLabel] = useState('Recorded')
  const displayValue = clampRating(hoverValue ?? value ?? 0)
  const justifyClass = align === 'left' ? 'items-start text-left' : 'items-end text-right'
  const iconSizeClass = sizeClasses[size] ?? sizeClasses.md

  useEffect(() => {
    if (showConfirmation) {
      const timer = setTimeout(() => setShowConfirmation(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [showConfirmation])

  const handleRate = (ratingValue) => {
    if (readOnly) return
    const currentValue = clampRating(value)
    setLastRated(ratingValue)
    setConfirmationLabel(Math.abs(currentValue - ratingValue) < 0.001 ? 'Cleared' : 'Recorded')
    setShowConfirmation(true)
    onRate?.(ratingValue)
  }

  return (
    <div className={`relative flex flex-col gap-1 ${justifyClass}`}>
      <div className="flex items-center gap-1">
        {STAR_VALUES.map((star) => {
          const fill = Math.min(Math.max(displayValue - (star - 1), 0), 1)
          const isRecentlySelected = Math.ceil(lastRated ?? 0) === star && showConfirmation
          const isHovered = !readOnly && hoverValue != null && Math.ceil(hoverValue) === star

          return (
            <div key={star} className={`relative ${readOnly ? 'h-6 w-6' : 'h-8 w-8'}`}>
              {!readOnly && (
                <>
                  <button
                    type="button"
                    aria-label={`Rate ${star - 0.5} stars`}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleRate(star - 0.5)
                    }}
                    onMouseEnter={() => setHoverValue(star - 0.5)}
                    onMouseLeave={() => setHoverValue(null)}
                    className="absolute inset-y-0 left-0 z-20 w-1/2 rounded-l focus-visible:outline-none active:scale-90 hover:scale-105 transition-transform"
                  />
                  <button
                    type="button"
                    aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleRate(star)
                    }}
                    onMouseEnter={() => setHoverValue(star)}
                    onMouseLeave={() => setHoverValue(null)}
                    className="absolute inset-y-0 right-0 z-20 w-1/2 rounded-r focus-visible:outline-none active:scale-90 hover:scale-105 transition-transform"
                  />
                </>
              )}

              <span className={`pointer-events-none absolute inset-0 flex items-center justify-center ${readOnly ? '' : 'p-1'}`}>
                <span className={`relative inline-flex transition-all duration-300 ${fill > 0 ? 'scale-[1.04]' : ''} ${isHovered ? '-translate-y-0.5' : ''}`}>
                  <FaStar aria-hidden="true" className={`${iconSizeClass} text-muted/40 transition-colors duration-300`} />
                  <span
                    className="absolute inset-y-0 left-0 overflow-hidden transition-all duration-300"
                    style={{ width: `${fill * 100}%` }}
                  >
                    <FaStar
                      aria-hidden="true"
                      className={`${iconSizeClass} text-white transition-all duration-300 ${
                        fill > 0 ? 'scale-105' : ''
                      } ${isRecentlySelected ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : ''}`}
                    />
                  </span>
                </span>
              </span>
            </div>
          )
        })}
      </div>

      {showConfirmation && (
        <div className="absolute -top-4 right-0 pointer-events-none animate-[fade-in_0.3s_ease-out]">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
            {confirmationLabel}
          </span>
        </div>
      )}

      {showValue && (
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          {displayValue ? `${displayValue.toFixed(1)} / 5` : readOnly ? 'Unrated' : 'Rate'}
        </p>
      )}
    </div>
  )
}

export default memo(RatingStars)
