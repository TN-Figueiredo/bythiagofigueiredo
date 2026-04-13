import { Instagram, Github, Linkedin, Mail } from 'lucide-react'

const socials = [
  {
    icon: Instagram,
    label: 'Instagram',
    href: 'https://www.instagram.com/thiagonfigueiredo',
  },
  {
    icon: Github,
    label: 'GitHub',
    href: 'https://github.com/TN-Figueiredo',
  },
  {
    icon: Linkedin,
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/bythiagofigueiredo/',
  },
  {
    icon: Mail,
    label: 'Email',
    href: 'mailto:bythiagofigueiredo@gmail.com',
  },
]

export function HubSocials() {
  return (
    <section className="px-6 pb-16">
      <div className="mx-auto max-w-2xl">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
          Find me online
        </p>
        <div className="flex justify-center gap-3">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-all hover:-translate-y-0.5 hover:border-primary-500/30 hover:text-primary-500"
            >
              <s.icon size={18} />
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
