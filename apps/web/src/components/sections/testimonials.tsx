import { Section } from '@/components/ui/section'

const testimonials = [
  {
    name: 'Terry Erb',
    title: 'Technology Enthusiast & Relationship Builder',
    quote:
      'Thiago is a fantastic team member and a pleasure to work with. He has a practical understanding of a project\'s purpose and his contributions consistently align with the bigger picture. His joy, technical expertise, and reliability make Thiago a valuable asset to any team.',
  },
  {
    name: 'Wagner Souza, MSc.',
    title: 'Principal Engineer | Senior Frontend Engineer',
    quote:
      'I have had the pleasure of working alongside Thiago on a huge project and can confidently say he is an exceptional front-end developer. His dedication to crafting optimized solutions is truly commendable.',
  },
  {
    name: 'Liz Sweeney',
    title: 'Agile Delivery Manager',
    quote:
      'In the manner of the "Ideal Team Player" Thiago stands at the intersection of the three virtues: humble, hungry and smart. He brings a sense of collaboration and mentorship that helps to unite a team.',
  },
  {
    name: 'Philip Blondé',
    title: 'Client Solutions Director at World Wide Technology',
    quote:
      'I highly recommend Thiago as a competent and reliable Software Engineer. His work showcased his technical expertise and his role as an informal tech lead. Thiago consistently demonstrates a deep understanding of React.',
  },
  {
    name: 'Faith W.',
    title: 'All Things Talent @ FuseITglobal.com',
    quote:
      'Thiago possesses a rare combination of technical expertise and a strong commitment to delivering high-quality results. His ability to tackle complex coding challenges with creativity and precision is truly commendable.',
  },
  {
    name: 'Elton Lima',
    title: 'IT Support & Operations Leader',
    quote:
      'Thiago is an exceptional software engineer with a proven track record. He approaches each project with infectious enthusiasm, demonstrating a positive mindset even in the face of complex challenges. He is recognized as a natural leader.',
  },
]

export function Testimonials() {
  return (
    <Section id="testimonials" label="Recomendações" title="O que dizem sobre mim">
      <div className="animate-on-scroll grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <figure
            key={t.name}
            className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 transition-colors hover:border-primary-500/20"
          >
            <blockquote className="mb-4 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="border-t border-[var(--border)] pt-4">
              <p className="font-semibold">{t.name}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{t.title}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  )
}
