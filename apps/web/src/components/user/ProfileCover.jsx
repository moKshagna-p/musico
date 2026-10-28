// Edge-to-edge backdrop behind the profile header that fades into the page, like the album Billboard.
// Rendered inside the page's `relative` main, so it spans the viewport from the top, under the floating nav.
const ProfileCover = ({ src }) =>
  src ? (
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[30rem] w-screen -translate-x-1/2">
      <img src={src} alt="" decoding="async" className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-canvas via-black/70 to-transparent" />
    </div>
  ) : null

export default ProfileCover
