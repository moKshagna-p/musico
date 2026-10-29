import { createSkeletonArray } from '../../utils/helpers.js'

// Same box as VinylSleeve; `out` shows the disc pulled halfway out like the hero sleeves.
export const SleeveSkeleton = ({ out = false }) => (
  <div aria-hidden="true" className="relative aspect-square">
    {out && <div className="vinyl absolute inset-[4%] translate-x-[40%]" />}
    <div className="relative h-full w-full overflow-hidden rounded-[4px] bg-panel shadow-sleeve">
      <div className="skeleton h-full w-full" />
    </div>
  </div>
)

// Mirrors AlbumCard: sleeve, title, artist, meta.
export const AlbumCardSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-3">
    <SleeveSkeleton />
    <div>
      <div className="skeleton my-[3px] h-[15px] w-3/4 rounded-full" />
      <div className="skeleton mb-1 mt-1.5 h-3 w-1/2 rounded-full" />
      <div className="skeleton mb-[3px] mt-[9px] h-2.5 w-2/5 rounded-full" />
    </div>
  </div>
)

// Mirrors AlbumTile: inset sleeve, title, artist, meta.
const AlbumTileSkeleton = () => (
  <div aria-hidden="true">
    <div className="pr-[12%]">
      <SleeveSkeleton />
    </div>
    <div className="skeleton mt-5 h-[18px] w-3/4 rounded-full" />
    <div className="skeleton mt-2.5 h-3 w-1/2 rounded-full" />
    <div className="skeleton mt-3.5 h-2.5 w-1/3 rounded-full" />
  </div>
)

const LoadingSkeleton = ({ count = 8, tile = false }) => {
  const Item = tile ? AlbumTileSkeleton : AlbumCardSkeleton
  return createSkeletonArray(count).map((_, index) => <Item key={index} />)
}

export default LoadingSkeleton
