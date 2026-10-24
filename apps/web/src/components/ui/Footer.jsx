import { Link } from 'react-router-dom'
import { FiGithub, FiMusic } from 'react-icons/fi'

import { MusicoMark } from './Navigation.jsx'

const Footer = () => {
  const socials = [
    { icon: <FiGithub />, label: 'Github', href: 'https://github.com/' },
    { icon: <FiMusic />, label: 'Spotify', href: 'https://open.spotify.com/' },
  ]

  return (
    <footer className="mt-24 border-t border-white/[0.07]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 tablet:flex-row tablet:items-end tablet:justify-between tablet:px-6">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Musico home">
            <MusicoMark className="h-6 w-6" />
            <span className="font-display text-xl leading-none text-paper">musico</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted">Rate records, keep lists, and follow people with good taste.</p>
        </div>
        <div className="flex items-center gap-5 text-sm text-muted">
          <span>&copy; {new Date().getFullYear()}</span>
          {socials.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              className="text-base transition-colors hover:text-paper"
            >
              {social.icon}
              <span className="sr-only">{social.label}</span>
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}

export default Footer
