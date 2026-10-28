const ProfileCover = ({ src }) =>
  src ? (
    <div className="relative mb-10 aspect-[3/1] w-full overflow-hidden rounded-3xl tablet:aspect-[4/1]">
      <img src={src} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden="true" />
    </div>
  ) : null

export default ProfileCover
