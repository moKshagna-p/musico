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

export const HomePageSkeleton = () => {
  return (
    <section aria-busy="true" aria-label="Loading home" className="space-y-12">
      <section className="overflow-hidden rounded-[2rem] border border-outline/50 bg-panel/50 px-6 py-10 tablet:px-10 tablet:py-14">
        <div className="max-w-3xl space-y-5">
          <div className="h-3 w-28 rounded-full bg-outline/70" />
          <div className="h-14 w-full max-w-2xl rounded-[1.25rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:320px_100%] animate-shimmer tablet:h-20" />
          <div className="h-4 w-full max-w-xl rounded-full bg-outline/60" />
          <div className="flex gap-3 pt-2">
            <div className="h-11 w-36 rounded-full bg-outline/65" />
            <div className="h-11 w-28 rounded-full bg-outline/45" />
          </div>
        </div>
      </section>

      {['Weekly Chart Pulse', 'Weekly Fresh Pull'].map((label) => (
        <section key={label} className="space-y-6">
          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
            <div className="space-y-3">
              <div className="h-3 w-28 rounded-full bg-outline/70" />
              <div className="h-10 w-72 rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer" />
            </div>
            <div className="h-3 w-20 rounded-full bg-outline/50" />
          </div>
          <div className="grid gap-6 tablet:grid-cols-2 laptop:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-4 rounded-3xl border border-outline/50 bg-panel/60 p-4">
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
        </section>
      ))}
    </section>
  )
}

export const DiscoverPageSkeleton = () => {
  return (
    <section aria-busy="true" aria-label="Loading discover" className="space-y-8">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-full bg-outline/70" />
        <div className="h-12 w-80 rounded-[1.1rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:260px_100%] animate-shimmer" />
      </div>
      <div className="rounded-2xl border border-outline/60 bg-panel/40 p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full bg-outline/60" />
          <div className="h-4 flex-1 rounded-full bg-outline/55" />
          <div className="h-7 w-14 rounded-lg bg-outline/45" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-3 w-28 rounded-full bg-outline/70" />
        <div className="grid gap-6 tablet:grid-cols-2 laptop:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="space-y-4 rounded-3xl border border-outline/50 bg-panel/60 p-4">
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

export const SearchResultsPageSkeleton = () => {
  return (
    <section aria-busy="true" aria-label="Loading search results" className="space-y-8">
      <div className="h-3 w-28 rounded-full bg-outline/60" />
      <div className="space-y-3">
        <div className="h-3 w-32 rounded-full bg-outline/70" />
        <div className="h-14 w-full max-w-md rounded-[1.1rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:260px_100%] animate-shimmer" />
      </div>
      <div className="rounded-2xl border border-outline/60 bg-panel/40 p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full bg-outline/60" />
          <div className="h-4 flex-1 rounded-full bg-outline/55" />
          <div className="h-7 w-14 rounded-lg bg-outline/45" />
        </div>
      </div>
      <div className="grid gap-6 tablet:grid-cols-2 laptop:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-4 rounded-3xl border border-outline/50 bg-panel/60 p-4">
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
    </section>
  )
}

export const FeedPageSkeleton = () => {
  return (
    <section aria-busy="true" aria-label="Loading feed" className="mx-auto w-full max-w-2xl py-2 tablet:py-6">
      <div className="flex items-end justify-between pb-8 pt-4 tablet:pb-10 tablet:pt-6">
        <div className="space-y-3">
          <div className="h-12 w-40 rounded-[1rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer" />
          <div className="h-4 w-56 rounded-full bg-outline/60" />
        </div>
        <div className="h-10 w-28 rounded-full bg-outline/50" />
      </div>
      <section className="mb-8 rounded-2xl border border-outline/60 bg-panel/30 p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full bg-outline/60" />
          <div className="h-4 flex-1 rounded-full bg-outline/55" />
        </div>
      </section>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex gap-4 rounded-2xl border border-outline/30 bg-panel/30 p-4">
            <div className="h-12 w-12 rounded-xl bg-outline/45" />
            <div className="flex-1 space-y-2.5 py-1">
              <div className="h-3.5 w-3/5 rounded-full bg-outline/65" />
              <div className="h-3 w-2/5 rounded-full bg-outline/50" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export const AuthPageSkeleton = () => {
  return (
    <section aria-busy="true" aria-label="Loading auth" className="mx-auto w-full max-w-xl px-2 py-8 tablet:py-14">
      <div className="overflow-hidden rounded-3xl border border-white/15 bg-panel/95 shadow-[0_24px_84px_rgba(0,0,0,0.5)]">
        <div className="border-b border-outline/80 px-5 py-6 tablet:px-8 tablet:py-8">
          <div className="h-3 w-28 rounded-full bg-outline/70" />
          <div className="mt-4 h-12 w-52 rounded-[1rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer" />
          <div className="mt-4 h-4 w-full max-w-sm rounded-full bg-outline/60" />
        </div>
        <div className="p-5 tablet:p-8">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-full border border-outline bg-canvas p-1">
            <div className="h-10 rounded-full bg-outline/60" />
            <div className="h-10 rounded-full bg-outline/35" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-3 w-16 rounded-full bg-outline/70" />
              <div className="h-12 rounded-xl bg-outline/45" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 rounded-full bg-outline/70" />
              <div className="h-12 rounded-xl bg-outline/45" />
            </div>
            <div className="h-12 rounded-full bg-outline/60" />
          </div>
        </div>
      </div>
    </section>
  )
}

export const AlbumDetailsPageSkeleton = () => {
  return (
    <section aria-busy="true" aria-label="Loading album details" className="space-y-8">
      <div className="h-3 w-20 rounded-full bg-outline/60" />
      <div className="grid gap-10 tablet:grid-cols-[360px,1fr]">
        <aside className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-panel p-2">
            <div className="aspect-square rounded-xl bg-gradient-to-r from-black via-neutral-800 to-black bg-[length:400px_100%] animate-shimmer" />
          </div>
          <div className="rounded-2xl border border-outline/50 bg-panel/40 p-5">
            <div className="space-y-3">
              <div className="h-4 w-24 rounded-full bg-outline/65" />
              <div className="h-10 rounded-xl bg-outline/45" />
              <div className="h-10 rounded-xl bg-outline/35" />
              <div className="h-10 rounded-xl bg-outline/30" />
            </div>
          </div>
        </aside>
        <section className="space-y-10">
          <header className="space-y-3 border-b border-outline pb-7">
            <div className="h-3 w-14 rounded-full bg-outline/70" />
            <div className="h-14 w-full max-w-2xl rounded-[1.2rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:320px_100%] animate-shimmer" />
            <div className="h-5 w-72 rounded-full bg-outline/60" />
            <div className="h-3 w-56 rounded-full bg-outline/50" />
            <div className="h-3 w-44 rounded-full bg-outline/50" />
          </header>
          <div className="grid gap-10 tablet:grid-cols-[0.62fr,1fr]">
            <section className="space-y-4 border-b border-outline pb-8 tablet:border-b-0 tablet:border-r tablet:pb-0 tablet:pr-8">
              <div className="h-3 w-16 rounded-full bg-outline/70" />
              <div className="h-16 w-28 rounded-[1rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer" />
              <div className="h-3 w-20 rounded-full bg-outline/55" />
              <div className="space-y-2 pt-3">
                <div className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-8 w-8 rounded-full bg-outline/40" />
                  ))}
                </div>
                <div className="h-3 w-20 rounded-full bg-outline/50" />
              </div>
            </section>
            <section className="rounded-[2rem] bg-panel/45 p-5 tablet:p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-3 w-16 rounded-full bg-outline/60" />
                    <div className="h-4 w-24 rounded-full bg-outline/45" />
                  </div>
                  <div className="h-3 w-16 rounded-full bg-outline/45" />
                </div>
                <div className="h-10 rounded-xl bg-outline/35" />
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-14 rounded-xl bg-outline/25" />
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </section>
  )
}

export const PublicListPageSkeleton = () => {
  return (
    <section
      aria-busy="true"
      aria-label="Loading list"
      className="mx-auto w-full max-w-6xl py-4 motion-safe:animate-pulse tablet:py-8"
    >
      <header className="py-8 text-center tablet:py-14">
        <div className="mx-auto h-3 w-12 rounded-full bg-outline/70" />
        <div className="mx-auto mt-4 h-12 w-80 max-w-[80%] rounded-[1rem] bg-white/10 tablet:h-16" />
        <div className="mx-auto mt-4 h-4 w-56 rounded-full bg-outline/60" />
        <div className="mx-auto mt-6 h-10 w-32 rounded-full bg-outline/45" />
      </header>
      <div className="grid grid-cols-2 gap-4 tablet:grid-cols-3 laptop:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-lg border border-outline/40 bg-panel/70">
            <div className="aspect-square w-full bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </section>
  )
}

export const NotFoundPageSkeleton = () => {
  return (
    <section aria-busy="true" aria-label="Loading page" className="mx-auto max-w-xl">
      <div className="rounded-3xl border border-outline bg-panel p-8 text-center">
        <div className="mx-auto h-3 w-12 rounded-full bg-outline/70" />
        <div className="mx-auto mt-4 h-12 w-72 rounded-[1rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer" />
        <div className="mx-auto mt-3 h-4 w-64 rounded-full bg-outline/60" />
        <div className="mx-auto mt-6 h-11 w-40 rounded-full bg-outline/45" />
      </div>
    </section>
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

export const ListeningHistoryPageSkeleton = () => {
  return (
    <section aria-busy="true" aria-label="Loading listening history" className="space-y-8">
      <div className="h-4 w-32 rounded-full bg-outline/70" />

      <header className="rounded-[2rem] border border-outline/70 bg-panel/45 p-6 tablet:p-10">
        <div className="h-3 w-36 rounded-full bg-outline/70" />
        <div className="mt-3 h-14 w-full max-w-lg rounded-[1.25rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:320px_100%] animate-shimmer" />
        <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-outline/60" />
      </header>

      <section className="grid gap-5 tablet:grid-cols-2 laptop:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="space-y-4 rounded-3xl border border-outline/50 bg-panel/60 p-4">
            <div className="aspect-square rounded-2xl bg-gradient-to-r from-black via-neutral-800 to-black bg-[length:400px_100%] animate-shimmer" />
            <div className="h-5 w-3/4 rounded-full bg-outline" />
            <div className="h-4 w-1/2 rounded-full bg-outline/80" />
            <div className="h-3 w-24 rounded-full bg-outline/60" />
          </div>
        ))}
      </section>
    </section>
  )
}

export const AdminDashboardPageSkeleton = () => {
  return (
    <section aria-busy="true" aria-label="Loading admin dashboard" className="space-y-8">
      <header className="rounded-[2rem] border border-outline/70 bg-panel/50 p-6 tablet:p-10">
        <div className="h-3 w-28 rounded-full bg-outline/70" />
        <div className="mt-3 h-14 w-full max-w-lg rounded-[1.25rem] bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:320px_100%] animate-shimmer" />
        <div className="mt-3 h-4 w-72 rounded-full bg-outline/60" />
      </header>

      <div className="grid gap-4 tablet:grid-cols-2 laptop:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-outline/70 bg-panel/50 p-5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded-full bg-outline/60" />
              <div className="h-4 w-4 rounded-full bg-outline/50" />
            </div>
            <div className="mt-4 h-10 w-20 rounded-full bg-outline/75" />
          </div>
        ))}
      </div>

      <section className="grid gap-4 laptop:grid-cols-[1.25fr,1fr]">
        <div className="rounded-3xl border border-outline/70 bg-panel/40 p-6">
          <div className="h-8 w-40 rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer" />
          <div className="mt-5 grid gap-3 tablet:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-outline/60 bg-canvas/40 p-4">
                <div className="h-4 w-28 rounded-full bg-outline/60" />
                <div className="mt-2 h-3 w-40 rounded-full bg-outline/45" />
                <div className="mt-4 h-7 w-14 rounded-full bg-outline/70" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-outline/70 bg-panel/40 p-6">
          <div className="h-8 w-36 rounded-full bg-gradient-to-r from-white/10 via-white/5 to-white/10 bg-[length:220px_100%] animate-shimmer" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-outline/55 bg-canvas/35 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 rounded-full bg-outline/55" />
                  <div className="h-4 w-10 rounded-full bg-outline/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  )
}

export default PageLoadingState
