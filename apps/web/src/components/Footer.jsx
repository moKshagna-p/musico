import { FiGithub, FiMusic } from 'react-icons/fi'

const Footer = () => {
  const socials = [
    { icon: <FiGithub />, label: 'Github', href: 'https://github.com/' },
    { icon: <FiMusic />, label: 'Spotify', href: 'https://open.spotify.com/' },
  ]

  return (
    <footer className="border-t border-outline bg-canvas py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 text-xs uppercase tracking-[0.4em] text-muted tablet:flex-row tablet:items-center tablet:justify-between">
        <p>musico · {new Date().getFullYear()}</p>
        <div className="flex items-center gap-4 text-base">
          {socials.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              className="text-muted transition hover:text-white"
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
