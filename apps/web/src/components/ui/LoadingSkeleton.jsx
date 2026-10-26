import { createSkeletonArray } from '../../utils/helpers.js'

const LoadingSkeleton = ({ count = 8 }) => {
  return (
    <>
      {createSkeletonArray(count).map((_, index) => (
        <div key={index} className="space-y-4" aria-hidden="true">
          <div className="aspect-square rounded-[4px] bg-gradient-to-r from-white/[0.03] via-white/[0.07] to-white/[0.03] bg-[length:400px_100%] motion-safe:animate-shimmer" />
          <div className="h-5 w-3/4 rounded-full bg-white/[0.06]" />
          <div className="h-3.5 w-1/2 rounded-full bg-white/[0.04]" />
        </div>
      ))}
    </>
  )
}

export default LoadingSkeleton
