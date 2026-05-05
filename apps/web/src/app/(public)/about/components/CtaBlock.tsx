import { Paper } from '@/components/pinboard/paper'
import { Tape } from '@/app/(public)/components/Tape'
import { localePath } from '@/lib/i18n/locale-path'
import { CtaChip } from './CtaChip'

const INTERNAL_ROUTES: Record<string, string> = {
  blog: '/blog',
  newsletters: '/newsletters',
  youtube: '/youtube',
}

interface CtaLink {
  type: 'internal' | 'social'
  key: string
  label: string
}

interface CtaBlockProps {
  locale: string
  kicker: string
  signature: string
  links: CtaLink[]
  socialLinks: Record<string, string> | null
}

export function CtaBlock({ locale, kicker, signature, links, socialLinks }: CtaBlockProps) {
  const resolvedLinks = links
    .map((link) => {
      if (link.type === 'internal') {
        const basePath = INTERNAL_ROUTES[link.key]
        return basePath ? { ...link, href: localePath(basePath, locale), external: false } : null
      }
      const href = socialLinks?.[link.key]
      return href ? { ...link, href, external: true } : null
    })
    .filter(Boolean) as Array<CtaLink & { href: string; external: boolean }>

  return (
    <section className="about-cta">
      <div style={{ position: 'relative', paddingTop: 18 }}>
        <Paper tint="var(--pb-paper2)" padding="28px 32px 24px" rotation={-0.3}>
          <Tape className="top-[-9px] left-[26%]" rotate={-3} />
          <Tape variant="tape2" className="top-[-9px] right-[30%]" rotate={2.5} />

          {kicker && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <span className="about-cta-kicker">◉ {kicker}</span>
              <span className="about-cta-line" />
            </div>
          )}

          {resolvedLinks.length > 0 && (
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
          )}

          {signature && (
            <div style={{ marginTop: 22 }}>
              <span className="about-signoff">{signature}</span>
            </div>
          )}
        </Paper>
      </div>
    </section>
  )
}
