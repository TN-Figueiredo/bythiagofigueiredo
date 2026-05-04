import { Paper } from '@/components/pinboard/paper'
import { Tape } from '@/app/(public)/components/Tape'
import { CtaChip } from './CtaChip'

const INTERNAL_ROUTES: Record<string, string> = {
  blog: '/blog',
  newsletters: '/newsletters',
  videos: '/videos',
}

interface CtaLink {
  type: 'internal' | 'social'
  key: string
  label: string
}

interface CtaBlockProps {
  kicker: string
  signature: string
  links: CtaLink[]
  socialLinks: Record<string, string> | null
}

export function CtaBlock({ kicker, signature, links, socialLinks }: CtaBlockProps) {
  const resolvedLinks = links
    .map((link) => {
      if (link.type === 'internal') {
        const href = INTERNAL_ROUTES[link.key]
        return href ? { ...link, href, external: false } : null
      }
      const href = socialLinks?.[link.key]
      return href ? { ...link, href, external: true } : null
    })
    .filter(Boolean) as Array<CtaLink & { href: string; external: boolean }>

  if (resolvedLinks.length === 0) return null

  return (
    <section className="about-cta">
      <div style={{ position: 'relative', paddingTop: 18 }}>
        <Paper tint="var(--pb-paper2)" padding="28px 32px 24px" rotation={-0.3}>
          <Tape className="top-[-9px] left-[26%]" rotate={-3} />
          <Tape variant="tape2" className="top-[-9px] right-[30%]" rotate={2.5} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <span className="about-cta-kicker">◉ {kicker}</span>
            <span className="about-cta-line" />
          </div>

          <div className="about-chips">
            {resolvedLinks.map((link, i) => (
              <CtaChip
                key={link.key}
                number={String(i + 1).padStart(2, '0')}
                label={link.label}
                href={link.href}
                external={link.external}
              />
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <span className="about-signoff">{signature}</span>
          </div>
        </Paper>
      </div>
    </section>
  )
}
