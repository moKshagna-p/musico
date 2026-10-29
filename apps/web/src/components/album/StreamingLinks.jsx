import { FaAmazon } from 'react-icons/fa'
import { FiArrowUpRight } from 'react-icons/fi'
import { SiApplemusic, SiSpotify, SiYoutubemusic } from 'react-icons/si'

// Simple Icons has no Amazon Music mark, so Amazon's smile stands in, in Amazon Music's teal.
const platforms = [
  { key: 'spotify', label: 'Spotify', Icon: SiSpotify, color: '#1ED760' },
  { key: 'appleMusic', label: 'Apple Music', Icon: SiApplemusic, color: '#FA2D48' },
  { key: 'youtubeMusic', label: 'YouTube Music', Icon: SiYoutubemusic, color: '#FF0033' },
  { key: 'amazonMusic', label: 'Amazon Music', Icon: FaAmazon, color: '#25D1DA' },
]

const StreamingLinks = ({ links = {} }) => {
  return (
    // Phones: the label on its own line over an even 2x2 grid. Wider screens: one wrapping row.
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <span className="col-span-2 text-sm text-muted sm:mr-2">Listen on</span>
      {platforms.map((platform) => {
        const href = links[platform.key]
        if (!href) {
          return (
            <span
              key={platform.key}
              aria-disabled="true"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/[0.06] px-3 py-2 sm:gap-2 sm:px-4 text-[13px] text-muted/60"
            >
              <platform.Icon aria-hidden="true" className="h-4 w-4" />
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
            style={{ '--brand': platform.color }}
            className="group inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 sm:gap-2 sm:px-4 text-[13px] text-paper backdrop-blur-sm transition-colors duration-200 hover:border-white/35 hover:bg-white/[0.08]"
          >
            <platform.Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--brand)] transition-transform duration-200 group-hover:scale-110" />
            <span className="truncate">{platform.label}</span>
            <FiArrowUpRight aria-hidden="true" className="shrink-0 text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-paper" />
          </a>
        )
      })}
    </div>
  )
}

export default StreamingLinks
