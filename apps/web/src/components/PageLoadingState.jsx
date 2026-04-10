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

export const ProfilePageSkeleton = ({ withBackButton = false, showActions = false }) => {
  return (
    <section aria-busy="true" aria-label="Loading profile" className="mx-auto w-full max-w-6xl py-4 tablet:py-8">
      {withBackButton && <div className="h-4 w-20 rounded-full bg-outline/70" />}

      <div className="py-8 text-center tablet:py-14">
        <div className="mx-auto mb-5 h-20 w-20 animate-pulse rounded-full bg-outline/60" />
        <div className="mx-auto h-12 w-64 max-w-[75%] rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:240px_100%] animate-shimmer tablet:h-16" />
        <div className="mx-auto mt-4 h-4 w-48 max-w-[60%] rounded-full bg-outline/70" />
        <div className="mx-auto mt-3 h-4 w-36 max-w-[45%] rounded-full bg-outline/50" />
        <div className="mx-auto mt-4 h-4 w-80 max-w-[82%] rounded-full bg-outline/60" />

        <div className="mt-6 flex items-center justify-center gap-8">
          <div className="space-y-2">
            <div className="mx-auto h-5 w-10 rounded-full bg-outline/70" />
            <div className="h-3.5 w-20 rounded-full bg-outline/50" />
          </div>
          <div className="space-y-2">
            <div className="mx-auto h-5 w-10 rounded-full bg-outline/70" />
            <div className="h-3.5 w-20 rounded-full bg-outline/50" />
          </div>
        </div>

        {showActions && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <div className="h-10 w-32 rounded-full bg-outline/60" />
            <div className="h-10 w-28 rounded-full bg-outline/50" />
          </div>
        )}
      </div>

      <main className="mt-10 tablet:mt-16">
        <section className="my-16">
          <div className="grid grid-cols-1 gap-8 text-center md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <div className="mx-auto h-12 w-24 rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer tablet:h-16" />
                <div className="mx-auto h-4 w-28 rounded-full bg-outline/60" />
              </div>
            ))}
          </div>
        </section>

        <section className="my-16 text-center">
          <div className="mx-auto mb-8 h-10 w-56 rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="mx-auto h-4 w-32 rounded-full bg-outline/60" style={{ width: `${8 + (index % 3) * 2}rem` }} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-10 text-center">
            <div className="mx-auto h-3 w-32 rounded-full bg-outline/70" />
            <div className="mx-auto mt-3 h-10 w-64 rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer" />
          </div>

          <div className="grid gap-6 tablet:grid-cols-2 laptop:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-4 rounded-3xl border border-outline/50 bg-panel/60 p-4">
                <div className="aspect-square rounded-2xl bg-gradient-to-r from-black via-neutral-800 to-black bg-[length:400px_100%] animate-shimmer" />
                <div className="h-5 w-3/4 rounded-full bg-outline" />
                <div className="h-4 w-1/2 rounded-full bg-outline/80" />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-10 text-center">
            <div className="mx-auto h-10 w-32 rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer" />
          </div>

          <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-[2.5rem] border border-outline/60 bg-panel/40 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="h-7 w-40 rounded-full bg-outline/80" />
                    <div className="h-3 w-24 rounded-full bg-outline/50" />
                  </div>
                  <div className="h-10 w-10 rounded-full bg-outline/50" />
                </div>
                <div className="mt-8 flex h-32 items-end gap-3 px-2">
                  {Array.from({ length: 4 }).map((__, stackIndex) => (
                    <div
                      key={stackIndex}
                      className="aspect-square w-24 rounded-xl bg-gradient-to-r from-black via-neutral-800 to-black bg-[length:240px_100%] animate-shimmer"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </section>
  )
}

export default PageLoadingState
