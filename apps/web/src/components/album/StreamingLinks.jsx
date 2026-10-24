import { FiArrowUpRight } from 'react-icons/fi'

const platforms = [
  { key: 'spotify', label: 'Spotify' },
  { key: 'appleMusic', label: 'Apple Music' },
  { key: 'youtubeMusic', label: 'YouTube Music' },
  { key: 'amazonMusic', label: 'Amazon Music' },
]

const StreamingLinks = ({ links = {} }) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-2 text-sm text-muted">Listen on</span>
      {platforms.map((platform) => {
        const href = links[platform.key]
        if (!href) {
          return (
            <span
              key={platform.key}
              aria-disabled="true"
              className="rounded-full border border-white/[0.06] px-4 py-2 text-[13px] text-muted/60"
            >
              {platform.label}
            </span>
          )
        }

        return (
          <a
            key={platform.key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[13px] text-paper backdrop-blur-sm transition-colors duration-200 hover:border-white/35 hover:bg-white/[0.08]"
          >
            {platform.label}
            <FiArrowUpRight aria-hidden="true" className="text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-paper" />
          </a>
        )
      })}
    </div>
  )
}

export default StreamingLinks
