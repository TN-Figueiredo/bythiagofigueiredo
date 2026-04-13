import { Youtube, BookOpen, Mail, Code2, ArrowUpRight } from 'lucide-react'

type HubLink = {
  icon: typeof Youtube
  title: string
  subtitle: string
  href: string
  external?: boolean
  featured?: boolean
}

const links: HubLink[] = [
  {
    icon: Youtube,
    title: 'YouTube · English',
    subtitle: '@bythiagofigueiredo — building in public',
    href: 'https://www.youtube.com/@bythiagofigueiredo',
    external: true,
    featured: true,
  },
  {
    icon: Youtube,
    title: 'YouTube · Português',
    subtitle: '@thiagonfigueiredo — bastidores em PT-BR',
    href: 'https://www.youtube.com/@thiagonfigueiredo',
    external: true,
    featured: true,
  },
  {
    icon: BookOpen,
    title: 'Blog',
    subtitle: 'Notas, tutoriais e ensaios',
    href: '/blog',
  },
  {
    icon: Mail,
    title: 'Newsletter',
    subtitle: 'Updates semanais direto na tua caixa',
    href: '/newsletter',
  },
  {
    icon: Code2,
    title: 'Portfolio Dev',
    subtitle: 'Trajetória técnica, experiências e projetos',
    href: '/dev',
  },
]

export function HubLinks() {
  return (
    <section className="px-6 pb-12">
      <div className="mx-auto max-w-2xl space-y-3">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noopener noreferrer' : undefined}
            className={`group flex items-center gap-4 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${
              link.featured
                ? 'border-primary-500/30 bg-gradient-to-br from-primary-500/10 to-accent-500/5 hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-600/10'
                : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-500/30 hover:shadow-md hover:shadow-[var(--shadow-md)]'
            }`}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                link.featured
                  ? 'bg-primary-500/15 text-primary-400'
                  : 'bg-primary-500/10 text-primary-500'
              }`}
            >
              <link.icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{link.title}</p>
              <p className="truncate text-sm text-[var(--text-secondary)]">
                {link.subtitle}
              </p>
            </div>
            <ArrowUpRight
              size={18}
              className="shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary-500"
            />
          </a>
        ))}
      </div>
    </section>
  )
}
