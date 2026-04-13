import { Mail, Linkedin, Building2 } from 'lucide-react'
import { Section } from '@/components/ui/section'

const cards = [
  {
    icon: Mail,
    label: 'Email',
    value: 'bythiagofigueiredo@gmail.com',
    href: 'mailto:bythiagofigueiredo@gmail.com',
  },
  {
    icon: Linkedin,
    label: 'LinkedIn',
    value: 'linkedin.com/in/bythiagofigueiredo',
    href: 'https://www.linkedin.com/in/bythiagofigueiredo/',
  },
]

export function Contact() {
  return (
    <Section id="contact" label="Fale comigo" title="Contato">
      <p className="animate-on-scroll mb-8 text-[var(--text-secondary)]">
        Tem um projeto em mente ou quer saber mais? Entre em contato.
      </p>

      <div className="animate-on-scroll grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <a
            key={card.label}
            href={card.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 transition-all hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-md hover:shadow-[var(--shadow-md)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
              <card.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                {card.label}
              </p>
              <p className="truncate text-sm font-medium">{card.value}</p>
            </div>
          </a>
        ))}

        {/* Company card — no link */}
        <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
            <Building2 size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              Empresa
            </p>
            <p className="text-sm font-medium">Figueiredo Technology LTDA</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              CNPJ: 44.243.373/0001-69
            </p>
          </div>
        </div>
      </div>
    </Section>
  )
}
