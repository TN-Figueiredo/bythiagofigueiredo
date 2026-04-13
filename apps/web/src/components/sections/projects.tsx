import { ExternalLink } from 'lucide-react'
import { Section } from '@/components/ui/section'

type Project = {
  name: string
  description: string
  stack: string[]
  links: { label: string; href: string }[]
  badge?: string
}

const projects: Project[] = [
  {
    name: 'TôNaGarantia',
    description:
      'App mobile para gestão de garantias de produtos. Importe notas fiscais, acompanhe prazos e receba alertas antes do vencimento — tudo em um só lugar.',
    stack: ['React Native', 'TypeScript', 'Node.js', 'Mobile'],
    links: [
      { label: 'Site', href: 'https://www.tonagarantia.com.br' },
      {
        label: 'Play Store',
        href: 'https://play.google.com/store/apps/details?id=com.tonagarantia',
      },
      {
        label: 'App Store',
        href: 'https://apps.apple.com/app/tonagarantia',
      },
    ],
    badge: 'Play Store & App Store',
  },
  {
    name: 'CreatorForge',
    description:
      'Plataforma para criadores de conteúdo gerenciarem sua presença digital, automações e monetização — do link-in-bio ao CMS completo.',
    stack: ['Next.js', 'TypeScript', 'Fastify', 'Supabase'],
    links: [],
    badge: 'Em desenvolvimento',
  },
  {
    name: 'bythiagofigueiredo.com',
    description:
      'Hub pessoal + CMS Engine. Este site que você está vendo — parte do ecossistema @tnf/* de pacotes compartilhados.',
    stack: ['Next.js 15', 'Tailwind CSS 4', 'React 19', 'Monorepo'],
    links: [
      { label: 'GitHub', href: 'https://github.com/TN-Figueiredo/bythiagofigueiredo' },
    ],
    badge: 'Open Source',
  },
]

export function Projects() {
  return (
    <Section id="projects" label="Portfolio" title="Projetos">
      <div className="animate-on-scroll grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <div
            key={project.name}
            className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 transition-all hover:-translate-y-1 hover:border-primary-500/30 hover:shadow-lg hover:shadow-[var(--shadow-lg)]"
          >
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-bold">{project.name}</h3>
              {project.badge && (
                <span className="shrink-0 rounded-full bg-primary-500/10 px-2.5 py-0.5 text-xs font-medium text-primary-400">
                  {project.badge}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="mb-4 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              {project.description}
            </p>

            {/* Stack */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {project.stack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]"
                >
                  {tech}
                </span>
              ))}
            </div>

            {/* Links */}
            {project.links.length > 0 && (
              <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-4">
                {project.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 transition-colors hover:text-primary-400"
                  >
                    {link.label}
                    <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}
