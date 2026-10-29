import { ALBUM_GRID_CLASS } from '../album/AlbumGrid.jsx'
import Billboard, { PAGE_GUTTER } from './Billboard.jsx'
import LoadingSkeleton, { SleeveSkeleton } from './LoadingSkeleton.jsx'
import { createSkeletonArray } from '../../utils/helpers.js'

// Each skeleton mirrors the current markup of its page so nothing jumps when the content lands.
// Big headings use font-display text-5xl / tablet:text-7xl across the app.
const TITLE = 'skeleton h-11 rounded-xl tablet:h-[4.25rem]'

const SectionHeadingSkeleton = ({ note = true }) => (
  <div aria-hidden="true" className="border-b border-white/[0.07] pb-4">
    <div className="skeleton h-6 w-48 rounded-lg tablet:h-[30px]" />
    {note && <div className="skeleton mt-3 h-3.5 w-56 max-w-full rounded-full" />}
  </div>
)

// SearchBar's pill at rest.
const SearchBarSkeleton = () => <div aria-hidden="true" className="skeleton h-[54px] rounded-full tablet:h-[62px]" />

const ListCardSkeleton = () => (
  <div aria-hidden="true" className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 tablet:p-6">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="skeleton h-7 w-40 rounded-lg tablet:h-9" />
        <div className="skeleton mt-2 h-3.5 w-16 rounded-full" />
      </div>
      <div className="skeleton mt-1 h-5 w-5 rounded-full" />
    </div>
    <div className="mt-8 flex h-24 items-end -space-x-8 tablet:h-28 tablet:-space-x-10">
      {createSkeletonArray(4).map((_, index) => (
        <div
          key={index}
          style={{ zIndex: 4 - index }}
          className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-[3px] bg-panel shadow-sleeve tablet:w-28"
        >
          <div className="skeleton h-full w-full" />
        </div>
      ))}
    </div>
  </div>
)

export const UserListLoadingState = () => (
  <div aria-busy="true" aria-label="Loading people" className="space-y-3">
    {createSkeletonArray(5).map((_, index) => (
      <div key={index} className="flex items-center gap-3 rounded-xl border border-outline/60 bg-canvas/30 px-4 py-3">
        <div className="skeleton h-11 w-11 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton h-3.5 w-32 rounded-full" />
          <div className="skeleton h-3 w-20 rounded-full" />
        </div>
      </div>
    ))}
  </div>
)

export const DiscoverPageSkeleton = () => (
  <section aria-busy="true" aria-label="Loading discover" className="space-y-20">
    <div className="mx-auto max-w-3xl pt-6 text-center tablet:pt-14">
      <div aria-hidden="true" className="relative font-display text-5xl leading-[0.95] tablet:text-7xl">
        <span className="invisible">Dig through the vault</span>
        <div className="skeleton absolute inset-y-0 left-[10%] w-4/5 rounded-2xl" />
      </div>
      <div className="skeleton mx-auto mt-6 h-4 w-72 max-w-full rounded-full" />
      <div className="mt-10">
        <SearchBarSkeleton />
      </div>
    </div>
    <div className="space-y-10">
      <SectionHeadingSkeleton />
      <div className={ALBUM_GRID_CLASS}>
        <LoadingSkeleton count={8} />
      </div>
    </div>
  </section>
)

export const SearchResultsPageSkeleton = () => (
  <section aria-busy="true" aria-label="Loading search results" className="space-y-12">
    <div className="space-y-8">
      <div>
        <div className="skeleton h-3.5 w-20 rounded-full" />
        <div className={`${TITLE} mt-3.5 w-2/3 max-w-md`} />
      </div>
      <div className="max-w-2xl">
        <SearchBarSkeleton />
      </div>
    </div>
    <div className="border-t border-white/[0.07] pt-12">
      <div className={ALBUM_GRID_CLASS}>
        <LoadingSkeleton count={8} />
      </div>
    </div>
  </section>
)

// Mirrors the feed: a day heading over ActivityCard groups.
export const FeedItemsSkeleton = () => (
  <div role="status" aria-label="Loading feed">
    <div className="border-b border-white/[0.06] py-2.5">
      <div className="skeleton my-0.5 h-3 w-14 rounded-full" />
    </div>
    <div className="divide-y divide-white/[0.06]">
      {[2, 1, 2].map((albums, index) => (
        <div key={index} className="flex items-start gap-3.5 py-5">
          <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 pt-1">
            <div className="skeleton h-3.5 w-28 rounded-full" />
            <div className="mt-4 space-y-3">
              {createSkeletonArray(albums).map((__, entry) => (
                <div key={entry} className="flex items-start gap-3">
                  <div className="skeleton h-12 w-12 shrink-0 rounded-[3px] tablet:h-14 tablet:w-14" />
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="skeleton h-3.5 w-2/5 rounded-full" />
                    <div className="skeleton mt-2.5 h-3 w-1/4 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

export const FeedPageSkeleton = () => (
  <section
    aria-busy="true"
    aria-label="Loading feed"
    className="mx-auto grid w-full max-w-6xl py-2 [grid-template-areas:'head''rail''feed'] tablet:grid-cols-[minmax(0,1fr)_20rem] tablet:grid-rows-[auto_1fr] tablet:gap-x-16 tablet:py-6 tablet:[grid-template-areas:'head_rail''feed_rail']"
  >
    <div className="flex items-end justify-between gap-4 pb-8 pt-4 [grid-area:head] tablet:pb-10 tablet:pt-6">
      <div className="min-w-0 flex-1">
        <div className="skeleton h-[3.75rem] w-40 rounded-2xl tablet:h-[4.5rem]" />
        <div className="skeleton mt-4 h-4 w-full max-w-sm rounded-full" />
      </div>
      <div className="skeleton h-9 w-[6.5rem] shrink-0 rounded-full" />
    </div>
    <div className="mb-8 [grid-area:rail] tablet:mb-0 tablet:pt-8">
      <div className="skeleton mb-4 hidden h-3 w-24 rounded-full tablet:block" />
      <div className="skeleton h-[50px] rounded-full" />
    </div>
    <div className="min-w-0 [grid-area:feed]">
      <FeedItemsSkeleton />
    </div>
  </section>
)

export const AuthPageSkeleton = () => (
  <section aria-busy="true" aria-label="Loading sign in" className="mx-auto grid w-full max-w-5xl items-center gap-12 py-6 md:grid-cols-[1fr_minmax(0,26rem)] tablet:py-16">
    <div className="hidden md:block" aria-hidden="true">
      <div className="vinyl relative mx-auto aspect-square w-[85%]" />
    </div>
    <div>
      <div className="skeleton h-12 w-48 rounded-2xl tablet:h-[3.75rem]" />
      <div className="skeleton mt-5 h-4 w-full max-w-sm rounded-full" />
      <div className="skeleton mt-8 h-[46px] rounded-full" />
      <div className="mt-6 space-y-4">
        {createSkeletonArray(2).map((_, index) => (
          <div key={index}>
            <div className="skeleton mb-2.5 h-3.5 w-16 rounded-full" />
            <div className="skeleton h-[54px] rounded-2xl" />
          </div>
        ))}
        <div className="skeleton h-12 rounded-full" />
      </div>
    </div>
  </section>
)

const TRACK_WIDTHS = ['w-2/3', 'w-1/2', 'w-3/5', 'w-2/5', 'w-3/4', 'w-1/2']

// Tracklist rows (number, name, duration), rendered inside the page's <ol>.
export const TrackRowsSkeleton = () =>
  TRACK_WIDTHS.map((width, index) => (
    <li key={index} aria-hidden="true" className="grid grid-cols-[2rem_minmax(0,1fr)_4rem] items-center gap-3 border-b border-white/[0.07] px-1 py-[18px]">
      <span className="skeleton h-3.5 w-3 rounded-full" />
      <span className={`skeleton h-3.5 rounded-full ${width}`} />
      <span className="skeleton ml-auto h-3.5 w-9 rounded-full" />
    </li>
  ))

// Rendered inside a bleed PageTransition, like the album page itself.
export const AlbumDetailsPageSkeleton = () => (
  <div aria-busy="true" aria-label="Loading album details">
    <Billboard className="tablet:min-h-[86svh]">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:gap-10">
        <div className="w-44 shrink-0 pr-14 tablet:w-64 tablet:pr-20">
          <SleeveSkeleton out />
        </div>
        <div className="min-w-0 flex-1">
          <div className="skeleton h-3.5 w-48 rounded-full" />
          <div className={`${TITLE} mt-4 w-full max-w-xl`} />
          <div className="skeleton mt-4 h-5 w-48 rounded-full tablet:h-6" />
          <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-5">
            <div>
              <div className="skeleton h-3.5 w-28 rounded-full" />
              <div className="skeleton mt-2.5 h-12 w-36 rounded-xl" />
            </div>
            <div>
              <div className="skeleton h-3.5 w-24 rounded-full" />
              <div className="skeleton mt-2.5 h-7 w-40 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-10 flex flex-wrap items-center gap-2">
        <div className="skeleton mr-2 h-3.5 w-16 rounded-full" />
        {['w-20', 'w-28', 'w-32', 'w-32'].map((width, index) => (
          <div key={index} className={`skeleton h-9 rounded-full ${width}`} />
        ))}
      </div>
    </Billboard>

    <div className={`${PAGE_GUTTER} mt-10`}>
      <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="skeleton h-8 w-36 rounded-xl" />
          <ol className="mt-5 border-t border-white/[0.07]">
            <TrackRowsSkeleton />
          </ol>
        </div>
        <div className="skeleton h-72 rounded-2xl" />
      </div>
      <div className="mt-20 max-w-3xl space-y-6">
        <div className="skeleton h-8 w-32 rounded-xl" />
        <div className="skeleton h-[4.5rem] rounded-2xl" />
      </div>
    </div>
  </div>
)

export const PublicListPageSkeleton = () => (
  <section aria-busy="true" aria-label="Loading list" className="mx-auto w-full max-w-6xl py-4 tablet:py-8">
    <header className="mb-14 flex flex-col gap-6 border-b border-white/[0.07] pb-10 pt-6 md:flex-row md:items-end md:justify-between tablet:pt-12">
      <div className="min-w-0 flex-1">
        <div className="skeleton h-3.5 w-28 rounded-full" />
        <div className={`${TITLE} mt-4 w-2/3 max-w-lg`} />
        <div className="skeleton mt-5 h-3.5 w-20 rounded-full" />
      </div>
      <div className="skeleton h-9 w-[7.5rem] shrink-0 rounded-full" />
    </header>
    <div className={ALBUM_GRID_CLASS}>
      <LoadingSkeleton count={8} tile />
    </div>
  </section>
)

export const NotFoundPageSkeleton = () => (
  <section aria-busy="true" aria-label="Loading page" className="mx-auto flex max-w-xl flex-col items-center py-10 tablet:py-20">
    <div aria-hidden="true" className="vinyl relative aspect-square w-40 opacity-80" />
    <div className="skeleton mt-10 h-24 w-full max-w-md rounded-2xl tablet:h-[7.5rem]" />
    <div className="skeleton mt-5 h-4 w-64 max-w-full rounded-full" />
    <div className="skeleton mt-8 h-11 w-36 rounded-full" />
  </section>
)

const ProfileHeaderSkeleton = ({ own }) => (
  <header className="flex flex-col gap-8 border-b border-white/[0.07] pb-10 md:flex-row md:items-end md:justify-between">
    <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-end">
      <div className="skeleton h-24 w-24 shrink-0 rounded-full tablet:h-32 tablet:w-32" />
      <div className="min-w-0">
        <div className={`${TITLE} w-64 max-w-full tablet:w-96`} />
        <div className="skeleton mt-4 h-3.5 w-28 rounded-full" />
        <div className="mt-5 flex gap-5">
          <div className="skeleton h-3.5 w-20 rounded-full" />
          <div className="skeleton h-3.5 w-20 rounded-full" />
        </div>
      </div>
    </div>
    <div className="flex gap-2">
      <div className="skeleton h-9 w-28 rounded-full" />
      {own && <div className="skeleton h-9 w-[6.5rem] rounded-full" />}
    </div>
  </header>
)

// `own` is the signed-in user's dashboard (/profile); otherwise a public profile.
export const ProfilePageSkeleton = ({ own = false }) => (
  <section aria-busy="true" aria-label="Loading profile" className="mx-auto w-full max-w-6xl py-4 tablet:py-8">
    <ProfileHeaderSkeleton own={own} />

    {own ? (
      <div className="mt-10 tablet:mt-16">
        <div className="my-14 grid grid-cols-1 divide-y divide-white/[0.07] border-y border-white/[0.07] md:grid-cols-3 md:divide-x md:divide-y-0">
          {createSkeletonArray(3).map((_, index) => (
            <div key={index} className="flex flex-col gap-2 px-1 py-8 md:px-8 md:first:pl-0">
              <div className="skeleton h-12 w-24 rounded-xl tablet:h-[3.75rem]" />
              <div className="skeleton my-[3px] h-3.5 w-28 rounded-full" />
            </div>
          ))}
        </div>

        <div className="my-14 grid gap-6 md:grid-cols-[16rem_1fr]">
          <div>
            <div className="skeleton h-[30px] w-52 rounded-lg tablet:h-9" />
            <div className="skeleton mt-3 h-3.5 w-40 rounded-full" />
          </div>
          <div className="space-y-3">
            {createSkeletonArray(5).map((_, index) => (
              <div key={index} className="grid h-5 grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-4">
                <div className="skeleton h-3.5 w-20 rounded-full" />
                <div className="skeleton h-1.5 rounded-full" style={{ width: `${100 - index * 16}%` }} />
                <div className="skeleton ml-auto h-3.5 w-4 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="my-14 grid gap-6 md:grid-cols-[16rem_1fr]">
          <div>
            <div className="skeleton h-[30px] w-44 rounded-lg tablet:h-9" />
            <div className="skeleton mt-3 h-3.5 w-48 rounded-full" />
          </div>
          <div className="skeleton h-48 rounded-xl" />
        </div>

        <div className="mb-8">
          <SectionHeadingSkeleton />
        </div>
        <div className="flex gap-4 overflow-hidden pb-3">
          {createSkeletonArray(6).map((_, index) => (
            <div key={index} className="w-[180px] flex-none tablet:w-[200px]">
              <SleeveSkeleton />
              <div className="skeleton mt-4 h-4 w-3/4 rounded-full" />
              <div className="skeleton mt-2.5 h-3 w-1/2 rounded-full" />
            </div>
          ))}
        </div>

        <div className="mt-24 grid gap-8 md:grid-cols-[16rem_1fr]">
          <div>
            <div className="skeleton h-[30px] w-52 rounded-lg tablet:h-9" />
            <div className="skeleton mt-3 h-3.5 w-48 rounded-full" />
            <div className="skeleton mt-6 h-16 w-40 rounded-xl" />
          </div>
          <div className="skeleton h-[140px] rounded-xl" />
        </div>

        <div className="mb-10 mt-24">
          <SectionHeadingSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-8 tablet:grid-cols-2">
          <ListCardSkeleton />
          <ListCardSkeleton />
        </div>
      </div>
    ) : (
      <div className="mt-14 space-y-24">
        <div>
          <div className="mb-10">
            <SectionHeadingSkeleton note={false} />
          </div>
          <div className={ALBUM_GRID_CLASS}>
            <LoadingSkeleton count={8} tile />
          </div>
        </div>
        <div>
          <div className="mb-10">
            <SectionHeadingSkeleton note={false} />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ListCardSkeleton />
            <ListCardSkeleton />
          </div>
        </div>
      </div>
    )}
  </section>
)

export const ListeningHistoryPageSkeleton = () => (
  <section aria-busy="true" aria-label="Loading listening history" className="space-y-8">
    <header className="border-b border-white/[0.07] pb-10">
      <div className={`${TITLE} w-3/4 max-w-xl`} />
      <div className="skeleton mt-5 h-4 w-64 max-w-full rounded-full" />
    </header>
    <div className={ALBUM_GRID_CLASS}>
      <LoadingSkeleton count={8} tile />
    </div>
  </section>
)

// Rows of the admin Users / Reviews panels, rendered inside their divided list.
export const AdminRowsSkeleton = () =>
  createSkeletonArray(5).map((_, index) => (
    <div key={index} aria-hidden="true" className="flex items-center justify-between gap-3 py-4">
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="skeleton h-3.5 w-36 max-w-full rounded-full" />
        <div className="skeleton h-3 w-48 max-w-full rounded-full" />
      </div>
      <div className="skeleton h-8 w-20 shrink-0 rounded-full" />
    </div>
  ))

export const AdminDashboardPageSkeleton = () => (
  <section aria-busy="true" aria-label="Loading admin dashboard" className="space-y-8">
    <header className="flex flex-col gap-6 border-b border-white/[0.07] pb-8 tablet:flex-row tablet:items-end tablet:justify-between">
      <div>
        <div className="skeleton h-12 w-64 rounded-xl tablet:h-[4.5rem] tablet:w-96" />
        <div className="skeleton mt-4 h-3.5 w-56 max-w-full rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 tablet:flex">
        {createSkeletonArray(4).map((_, index) => (
          <div key={index} className="rounded-2xl border border-outline/60 bg-panel/30 px-4 py-3 tablet:w-28">
            <div className="skeleton my-0.5 h-3 w-14 rounded-full" />
            <div className="skeleton mt-1.5 h-[30px] w-12 rounded-lg" />
          </div>
        ))}
      </div>
    </header>

    <div className="grid gap-4 laptop:grid-cols-2">
      {['tablet:w-72', 'tablet:w-44'].map((controlWidth) => (
        <div key={controlWidth} className="rounded-2xl border border-outline/70 bg-panel/35 p-4 tablet:p-5">
          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
            <div className="skeleton h-8 w-28 rounded-lg" />
            <div className={`skeleton h-9 w-full rounded-full ${controlWidth}`} />
          </div>
          <div className="mt-4 divide-y divide-outline/55">
            <AdminRowsSkeleton />
          </div>
        </div>
      ))}
    </div>
  </section>
)
