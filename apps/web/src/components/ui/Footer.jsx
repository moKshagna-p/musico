import { Link } from 'react-router-dom'
import { SiApplemusic, SiGithub } from 'react-icons/si'

import { MusicoMark } from './Navigation.jsx'

const columns = [
  {
    title: 'Explore',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Discover', to: '/discover' },
      { label: 'Feed', to: '/feed' },
    ],
  },
  {
    title: 'You',
    links: [
      { label: 'Profile', to: '/profile' },
      { label: 'Listening history', to: '/profile/history' },
    ],
  },
]

const socials = [
  { icon: <SiGithub />, label: 'GitHub', href: 'https://github.com/moKshagna-p/musico' },
  { icon: <SiApplemusic />, label: 'Apple Music', href: 'https://music.apple.com/profile/mokshagna45' },
]

const Footer = () => (
  <footer className="relative mt-24 overflow-hidden border-t border-white/[0.07]">
    {/* An oxblood pressing rising out of the bottom edge, behind the oversized wordmark */}
    <div
      aria-hidden="true"
      style={{ '--vinyl': '#5c1420' }}
      className="vinyl pointer-events-none absolute -bottom-40 -right-16 h-64 w-64 tablet:-bottom-60 tablet:right-[5%] tablet:h-[26rem] tablet:w-[26rem]"
    >
      <span className="absolute inset-[38%] rounded-full bg-paper/90" />
      <span className="absolute inset-[48.5%] rounded-full bg-canvas" />
    </div>

    <div className="relative mx-auto max-w-6xl px-4 pt-14 tablet:px-6 tablet:pt-20">
      <div className="grid gap-12 tablet:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Musico home">
            <MusicoMark className="h-6 w-6" />
            <span className="font-display text-xl leading-none text-paper">musico</span>
          </Link>
          <p className="mt-6 max-w-sm font-display text-3xl leading-[1.05] text-paper tablet:text-4xl">
            Good taste, on the record.
          </p>
          <p className="mt-3 max-w-xs text-sm text-muted">Rate records, keep lists, and follow people with good taste.</p>
        </div>

        <div className="grid grid-cols-2 gap-8 tablet:contents">
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-xs uppercase tracking-[0.2em] text-muted/70">{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-sm text-paper/70 transition-colors hover:text-paper">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="mt-14 flex flex-col gap-4 border-t border-white/[0.07] pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          &copy; {new Date().getFullYear()} Musico &middot; Data from{' '}
          <a href="https://www.discogs.com/" target="_blank" rel="noreferrer" className="underline-offset-4 transition-colors hover:text-paper hover:underline">
            Discogs
          </a>
        </p>
        <div className="flex items-center gap-2">
          {socials.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] text-base transition-colors hover:border-white/25 hover:text-paper"
            >
              {social.icon}
              <span className="sr-only">{social.label}</span>
            </a>
          ))}
        </div>
      </div>

      <p
        aria-hidden="true"
        className="pointer-events-none -mb-[0.1em] mt-8 select-none bg-gradient-to-b from-white/[0.14] to-white/[0.03] bg-clip-text font-display text-[26vw] leading-[0.8] text-transparent tablet:text-[15rem]"
      >
        musico
      </p>
    </div>
  </footer>
)

export default Footer
