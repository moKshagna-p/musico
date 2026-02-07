import { FiExternalLink } from 'react-icons/fi'

const platforms = [
  { key: 'spotify', label: 'Spotify' },
  { key: 'appleMusic', label: 'Apple Music' },
  { key: 'youtubeMusic', label: 'YouTube Music' },
  { key: 'amazonMusic', label: 'Amazon Music' },
]

const StreamingLinks = ({ links = {} }) => {
  return (
    <div className="grid gap-3 tablet:grid-cols-2">
      {platforms.map((platform) => (
        <a
          key={platform.key}
          href={links[platform.key] ?? '#'}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!links[platform.key]}
          className={`group flex items-center justify-between rounded-2xl border border-outline px-4 py-4 text-sm uppercase tracking-[0.2em] text-white ${links[platform.key] ? 'hover:bg-white/5' : 'opacity-40'}`}
        >
          {platform.label}
          <FiExternalLink className="transition group-hover:translate-x-1" />
        </a>
      ))}
    </div>
  )
}

export default StreamingLinks
