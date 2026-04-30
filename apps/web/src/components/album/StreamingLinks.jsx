import { FiExternalLink } from 'react-icons/fi'

const platforms = [
  { key: 'spotify', label: 'Spotify' },
  { key: 'appleMusic', label: 'Apple Music' },
  { key: 'youtubeMusic', label: 'YouTube Music' },
  { key: 'amazonMusic', label: 'Amazon Music' },
]

const StreamingLinks = ({ links = {} }) => {
  return (
    <div className="grid gap-2 tablet:grid-cols-2">
      {platforms.map((platform) => {
        const href = links[platform.key]
        if (!href) {
          return (
            <span
              key={platform.key}
              aria-disabled="true"
              className="flex items-center justify-between rounded-xl border border-outline/80 px-4 py-3 text-xs uppercase tracking-[0.24em] text-muted/70"
            >
              {platform.label}
              <FiExternalLink aria-hidden="true" />
            </span>
          )
        }

        return (
          <a
            key={platform.key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center justify-between rounded-xl border border-outline px-4 py-3 text-xs uppercase tracking-[0.24em] text-white transition-colors duration-200 hover:border-white/35 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            {platform.label}
            <FiExternalLink aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
        )
      })}
    </div>
  )
}

export default StreamingLinks
