// Edge-to-edge backdrop behind the profile header that fades into the page, like the album Billboard.
// Rendered inside the page's `relative` main, so it spans the viewport from the top, under the floating nav.
// On phones the header stacks tall, so the cover is a shorter banner with lighter scrims to keep the image visible.
const ProfileCover = ({ src }) =>
  src ? (
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-screen -translate-x-1/2 tablet:h-[30rem]">
      <img src={src} alt="" decoding="async" className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent tablet:h-40 tablet:from-black/70" />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-black/60 via-black/20 to-transparent tablet:block" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas to-transparent tablet:h-3/4 tablet:via-black/75 tablet:from-15%" />
    </div>
  ) : null

export default ProfileCover
