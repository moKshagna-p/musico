import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'
import CoverImage from '../ui/CoverImage.jsx'

const ListCard = ({ list }) => {
  const MotionDiv = motion.div
  const albums = list.albums || []
  const displayAlbums = albums.slice(0, 4)
  const count = list.albumCount ?? albums.length

  return (
    <Link to={`/lists/${list.id}`} className="group block">
      <MotionDiv
        whileHover={{ y: -8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative overflow-hidden rounded-[2rem] border border-outline/60 bg-panel/40 p-4 backdrop-blur-md transition-colors hover:border-white/30 tablet:rounded-[2.5rem] tablet:p-6"
      >
        {/* Background glow */}
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5 blur-3xl transition-opacity group-hover:bg-white/10" />

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-medium tracking-wide text-white/90 group-hover:text-white tablet:text-2xl">
              {list.name}
            </h3>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-muted tablet:tracking-[0.45em]">
              {count} {count === 1 ? 'Album' : 'Albums'}
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline bg-canvas/50 text-muted transition-colors group-hover:bg-white group-hover:text-canvas">
            <FiChevronRight className="text-xl" />
          </div>
        </div>

        <div className="relative mt-6 flex min-w-0 items-end justify-between gap-3 px-1 tablet:mt-8 tablet:px-2">
          {displayAlbums.length > 0 ? (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex -space-x-7 pr-2 tablet:-space-x-10">
              {displayAlbums.map((album, index) => {
                const rotations = [-6, -2, 2, 6]
                const rotate = rotations[index % rotations.length]
                
                return (
                  <MotionDiv
                    key={album.id || index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    style={{ rotate: `${rotate}deg` }}
                    className="relative aspect-square w-[4.7rem] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-2xl transition-transform group-hover:scale-105 group-hover:rotate-0 tablet:w-24"
                  >
                    <CoverImage
                      src={album.cover}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </MotionDiv>
                )
              })}
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed border-outline/40">
              <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-muted/60">Empty</p>
            </div>
          )}
          
          {count > 4 && (
            <div className="mb-1 shrink-0 tablet:mb-2">
              <span className="whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted backdrop-blur-md tablet:tracking-[0.3em]">
                +{count - 4} more
              </span>
            </div>
          )}
        </div>
      </MotionDiv>
    </Link>
  )
}

export default ListCard
