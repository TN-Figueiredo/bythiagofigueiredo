import { Section } from '@/components/ui/section'

const positions = [
  {
    role: 'Founder & Lead Architect',
    company: 'Figueiredo Technology',
    period: 'Jan 2024 — Presente',
    location: 'Minas Gerais, Brasil — Remoto',
    description:
      'Fundação e liderança técnica da empresa. Arquitetura de produtos digitais, gestão de equipes e desenvolvimento full stack do ecossistema de apps.',
    tags: ['React', 'TypeScript', 'Node.js', 'Arquitetura'],
  },
  {
    role: 'Senior Frontend Developer',
    company: 'W2T.io',
    period: 'Set 2022 — Jan 2024',
    location: 'Estados Unidos — Remoto',
    description:
      'Entrega de resultados de alta qualidade em ambiente colaborativo. Reconhecido como Contractor of the Month pela excelência técnica e contribuição para o time.',
    tags: ['React', 'TypeScript', 'Frontend'],
  },
  {
    role: 'Full Stack Engineer',
    company: 'Trybe Inc.',
    period: 'Mai 2019 — Jul 2022',
    location: 'Greater Toronto Area, Canadá',
    description:
      'Liderança na implementação frontend, garantindo uma experiência de usuário sólida e refinada. Manutenção e criação de novas APIs quando necessário.',
    tags: ['React', 'React Native', 'Node.js'],
  },
  {
    role: 'Full Stack Developer',
    company: 'Arena Gaming TV',
    period: 'Abr 2012 — Jul 2017',
    location: 'Belo Horizonte, Brasil',
    description:
      'Desenvolvimento completo de uma plataforma para startup própria incluindo loja, fórum e canais de transmissão ao vivo.',
    tags: ['HTML', 'CSS', 'PHP', 'MySQL'],
  },
]

const education = [
  {
    institution: 'Seneca Polytechnic',
    course: 'Computer Programming, Information Technology',
    period: '2017 — 2019',
  },
  {
    institution: 'Escola Politécnica de Minas Gerais',
    course: 'Computer Programmer Technician, Information Technology',
    period: '2011 — 2012',
  },
]

export function Experience() {
  return (
    <Section id="experience" label="Trajetória" title="Experiência">
      {/* Timeline */}
      <div className="animate-on-scroll relative space-y-8 border-l-2 border-[var(--border)] pl-8">
        {positions.map((pos) => (
          <div key={pos.role + pos.company} className="relative">
            {/* Dot */}
            <div className="absolute -left-[calc(2rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-primary-500 bg-[var(--bg)]" />

            <div className="space-y-2">
              <div>
                <h3 className="text-lg font-bold">{pos.role}</h3>
                <p className="text-sm font-medium text-primary-500">
                  {pos.company}
                </p>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                {pos.period} &middot; {pos.location}
              </p>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {pos.description}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {pos.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-primary-500/10 px-2.5 py-0.5 text-xs font-medium text-primary-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Education */}
      <div className="animate-on-scroll mt-16">
        <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-primary-500">
          Formação
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {education.map((edu) => (
            <div
              key={edu.institution}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-primary-500/30"
            >
              <h4 className="font-bold">{edu.institution}</h4>
              <p className="text-sm text-[var(--text-secondary)]">{edu.course}</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">{edu.period}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
