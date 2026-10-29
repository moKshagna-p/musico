import { motion as Motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'

// Edge-to-edge backdrop behind the profile header that fades into the page, like the album Billboard.
// Rendered inside the page's `relative` main, so it spans the viewport from the top, under the floating nav.
// On phones the header stacks tall, so the cover is a shorter banner with lighter scrims to keep the image visible.
// The image settles in on load and drifts at a third of the scroll speed for depth.
const ProfileCover = ({ src }) => {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 480], [0, 160])
  const reduceMotion = useReducedMotion()

  if (!src) return null

  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-screen -translate-x-1/2 overflow-hidden tablet:h-[30rem]">
      <Motion.img
        src={src}
        alt=""
        decoding="async"
        style={reduceMotion ? undefined : { y }}
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent tablet:h-40 tablet:from-black/70" />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-black/60 via-black/20 to-transparent tablet:block" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas to-transparent tablet:h-3/4 tablet:via-black/75 tablet:from-15%" />
    </div>
  )
}

export default ProfileCover
