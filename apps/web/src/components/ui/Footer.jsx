import { motion as Motion } from 'framer-motion'
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
  <footer className="relative mt-24 overflow-hidden border-t border-white/[0.07] pb-[env(safe-area-inset-bottom)]">
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

      {/* The wrapper hugs the wordmark and carries its font size, so the record is placed in em from the last "o"
          at every screen width. Clipped text only paints inside its line box, so the line is tall enough for the
          i's dot; the negative margin then sinks the empty space under the letters below the edge so they sit on it. */}
      <div className="relative mt-6 w-fit font-display text-[20vw] tablet:mt-8 tablet:text-[15rem]">
        {/* An oxblood pressing rising out of the footer's bottom edge, which sits 0.14em above the wrapper's. */}
        <Motion.div
          aria-hidden="true"
          style={{ '--vinyl': '#5c1420' }}
          initial={{ y: '45%', x: '20%', rotate: 120, opacity: 0 }}
          whileInView={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="vinyl pointer-events-none absolute -bottom-[0.87em] left-[calc(100%+0.05em)] h-[2.25em] w-[2.25em] sm:-bottom-[0.65em] sm:h-[1.75em] sm:w-[1.75em]"
        >
          <span className="absolute inset-[38%] rounded-full bg-paper/90" />
          <span className="absolute inset-[48.5%] rounded-full bg-canvas" />
        </Motion.div>
        <p
          aria-hidden="true"
          className="pointer-events-none relative -mb-[0.14em] select-none bg-gradient-to-b from-white/[0.16] to-white/[0.04] bg-clip-text leading-[1.15] text-transparent"
        >
          musico
        </p>
      </div>
    </div>
  </footer>
)

export default Footer
