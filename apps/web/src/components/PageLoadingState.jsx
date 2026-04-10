const shimmerDelays = ['0ms', '90ms', '180ms']

const PageLoadingState = ({ title = 'Loading content', cards = 3, compact = false }) => {
  return (
    <section
      aria-busy="true"
      aria-label={title}
      className={`mx-auto w-full max-w-6xl ${compact ? 'py-8' : 'py-6 tablet:py-10'}`}
    >
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="h-3 w-24 rounded-full bg-outline/80" />
          <div className="h-12 w-64 max-w-[70%] rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:240px_100%] animate-shimmer" />
          <div className="h-4 w-80 max-w-[85%] rounded-full bg-outline/60" />
        </div>

        <div className="grid gap-6 tablet:grid-cols-2 laptop:grid-cols-3">
          {Array.from({ length: cards }).map((_, index) => (
            <div
              key={index}
              className="space-y-4 rounded-3xl border border-outline/50 bg-panel/60 p-4"
              style={{ animationDelay: shimmerDelays[index % shimmerDelays.length] }}
            >
              <div className="aspect-square rounded-2xl bg-gradient-to-r from-black via-neutral-800 to-black bg-[length:400px_100%] animate-shimmer" />
              <div className="h-6 w-3/4 rounded-full bg-outline" />
              <div className="h-4 w-1/2 rounded-full bg-outline/80" />
              <div className="flex gap-3">
                <div className="h-4 w-20 rounded-full bg-outline/70" />
                <div className="h-4 w-14 rounded-full bg-outline/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export const UserListLoadingState = () => {
  return (
    <div aria-busy="true" aria-label="Loading people" className="mt-5 space-y-3 pr-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl border border-outline/60 bg-canvas/30 px-4 py-3">
          <div className="h-11 w-11 animate-pulse rounded-full bg-outline/60" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded-full bg-outline/70" />
            <div className="h-3 w-20 rounded-full bg-outline/50" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default PageLoadingState
