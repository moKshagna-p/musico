import { createSkeletonArray } from '../utils/helpers.js'

const LoadingSkeleton = ({ count = 8 }) => {
  return (
    <>
      {createSkeletonArray(count).map((_, index) => (
        <div key={index} className="space-y-4 rounded-3xl border border-outline bg-panel p-4">
          <div className="h-64 rounded-2xl bg-gradient-to-r from-black via-neutral-800 to-black bg-[length:400px_100%] animate-shimmer" />
          <div className="h-6 w-3/4 rounded-full bg-outline" />
          <div className="h-4 w-1/2 rounded-full bg-outline/80" />
          <div className="flex justify-between">
            <div className="h-4 w-20 rounded-full bg-outline/80" />
            <div className="h-4 w-12 rounded-full bg-outline/80" />
          </div>
        </div>
      ))}
    </>
  )
}

export default LoadingSkeleton
