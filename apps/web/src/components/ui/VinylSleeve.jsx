import CoverImage from './CoverImage.jsx'

// A record sleeve with its disc behind it. `out` pulls the disc halfway out;
// otherwise it slides out (right, or `up` like pulling from a crate) on hover of the nearest `.group`.
const HOVER_PULL = {
  right: 'group-hover:translate-x-[16%] group-focus-visible:translate-x-[16%]',
  up: 'group-hover:-translate-y-[18%] group-focus-visible:-translate-y-[18%]',
}

const VinylSleeve = ({ src, alt = '', out = false, pull = 'right', spin = false, size = 640, loading = 'lazy', sizes, className = '' }) => (
  <div className={`relative aspect-square ${className}`}>
    <div
      aria-hidden="true"
      className={`vinyl absolute inset-[4%] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        out ? 'translate-x-[40%]' : HOVER_PULL[pull]
      }`}
    >
      <div className={`absolute inset-[33%] overflow-hidden rounded-full ring-1 ring-black ${spin ? 'motion-safe:animate-[vinylSpin_9s_linear_infinite]' : ''}`}>
        {src ? <img src={src} alt="" loading={loading} decoding="async" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-paper/80" />}
        <span className="absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
      </div>
    </div>
    <div className="relative h-full w-full overflow-hidden rounded-[4px] bg-panel shadow-sleeve">
      <CoverImage
        src={src}
        alt={alt}
        width={size}
        height={size}
        sizes={sizes}
        loading={loading}
        className="block aspect-square h-full w-full object-cover"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[4px] ring-1 ring-inset ring-white/10" />
    </div>
  </div>
)

export default VinylSleeve
