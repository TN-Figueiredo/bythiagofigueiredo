import { Section } from '@/components/ui/section'

const skills = [
  {
    category: 'Frontend',
    items: ['React', 'Next.js', 'TypeScript', 'Angular', 'React Native', 'Gatsby'],
  },
  {
    category: 'Backend',
    items: ['Node.js', 'Fastify', 'REST APIs', 'GraphQL', 'PHP', 'MySQL'],
  },
  {
    category: 'Ferramentas',
    items: ['Git', 'Docker', 'CI/CD', 'Jest', 'Vitest', 'Figma'],
  },
  {
    category: 'Liderança',
    items: ['Arquitetura', 'Gestão', 'Code Review', 'Agile'],
  },
]

export function About() {
  return (
    <Section id="about" label="Quem sou eu" title="Sobre mim">
      <div className="animate-on-scroll grid gap-12 md:grid-cols-5">
        {/* Bio — 3 cols */}
        <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed md:col-span-3">
          <p>
            Com mais de 12 anos construindo produtos digitais, sou especializado
            em tecnologias como React, TypeScript e Node.js — do frontend ao
            backend, da concepção ao deploy.
          </p>
          <p>
            Minha paixão está em transformar ideias em produtos reais. Fundei a
            Figueiredo Technology para construir soluções que resolvem problemas
            concretos, desde apps mobile até plataformas web completas.
          </p>
          <p>
            Atuo como Founder e Lead Architect, identificando oportunidades,
            desenhando arquiteturas e liderando equipes para entregar produtos
            com qualidade e velocidade.
          </p>
        </div>

        {/* Skills — 2 cols */}
        <div className="space-y-6 md:col-span-2">
          {skills.map((group) => (
            <div key={group.category}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary-500">
                {group.category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.items.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
