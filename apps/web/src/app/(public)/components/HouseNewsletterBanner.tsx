import type { HomeNewsletter } from '../../../../lib/home/types'

type Props = {
  newsletter: HomeNewsletter | null
  locale: 'en' | 'pt-BR'
  subscriberCount: number
  t: Record<string, string>
}

export function HouseNewsletterBanner({ newsletter, locale, subscriberCount, t }: Props) {
  const slug = newsletter?.slug ?? 'field-notes'

  return (
    <section
      aria-label={t['home.newsletter.bannerCta']}
      className="px-[18px] md:px-7"
      style={{
        maxWidth: 920,
        margin: '0 auto',
        paddingTop: 40,
      }}
    >
      <div
        style={{
          background: 'var(--pb-accent)',
          padding: 'clamp(20px, 4vw, 32px) clamp(20px, 4vw, 36px) clamp(18px, 3vw, 28px)',
          position: 'relative',
          overflow: 'hidden',
          transform: 'rotate(-0.25deg)',
        }}
      >
        {/* Decorative tape at top center */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            marginLeft: -40,
            width: 80,
            height: 18,
            background: 'var(--pb-tape-warm)',
            transform: 'rotate(3deg)',
            boxShadow: 'var(--pb-shadow-sm)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--pb-ink-on-accent)', opacity: 0.7 }}>
            house
          </span>
          <span style={{ color: 'var(--pb-ink-on-accent)', fontSize: 10, opacity: 0.4 }}>·</span>
          <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--pb-ink-on-accent)', opacity: 0.7 }}>
            newsletter
          </span>
        </div>

        <h2 className="font-fraunces" style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 500, letterSpacing: '-0.015em', color: 'var(--pb-ink-on-accent)', margin: 0, lineHeight: 1.15, textWrap: 'balance' }}>
          {t['home.newsletter.bannerTitle']}
        </h2>

        <p style={{ fontSize: 14, color: 'var(--pb-ink-on-accent)', opacity: 0.85, marginTop: 10, lineHeight: 1.55, maxWidth: 640 }}>
          {subscriberCount > 0
            ? (t['home.newsletter.bannerBodyWithCount'] ?? '').replace('{count}', subscriberCount.toLocaleString(locale))
            : t['home.newsletter.bannerBody']}
        </p>

        <a
          href={`/newsletters/${slug}`}
          className="font-mono inline-block"
          style={{
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'var(--pb-accent)',
            background: 'var(--pb-ink-on-accent)',
            padding: '12px 24px',
            textDecoration: 'none',
            marginTop: 18,
          }}
        >
          {t['home.newsletter.bannerCta']}
        </a>
      </div>
    </section>
  )
}
