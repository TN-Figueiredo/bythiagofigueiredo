'use client'

import type { AdProps, AdLocaleKey } from './types'
import { useDismissable } from './use-dismissable'
import { DismissButton } from './dismiss-button'

/**
 * Coda — large card after article body.
 * Editorial card with serif headline, plenty of breathing room.
 * Grid layout: mark left, content right. Brand-color top border accent.
 */
export function CodaAd({ ad, locale, onDismiss }: AdProps) {
  const [dismissed, dismiss] = useDismissable('c_' + ad.id, onDismiss)
  if (dismissed) return null

  const L: AdLocaleKey = locale === 'pt-BR' ? 'pt' : 'en'
  const label = L === 'pt' ? ad.label_pt : ad.label_en
  const headline = L === 'pt' ? ad.headline_pt : ad.headline_en
  const body = L === 'pt' ? ad.body_pt : ad.body_en
  const cta = L === 'pt' ? ad.cta_pt : ad.cta_en
  const tagline = L === 'pt' ? ad.tagline_pt : ad.tagline_en

  return (
    <div
      className="relative mt-12"
      style={{
        padding: '32px 32px 28px',
        border: '2px solid var(--pb-line)',
        borderTop: `4px solid ${ad.brandColor}`,
        background: 'var(--pb-coda-bg, rgba(0,0,0,0.012))',
      }}
    >
      {/* Dismiss button (top right) */}
      <div className="absolute right-3.5 top-3.5">
        <DismissButton onClick={dismiss} />
      </div>

      {/* Label pill */}
      <div className="mb-5">
        <span
          className="font-jetbrains inline-flex items-center gap-1.5"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            fontWeight: 700,
            color: '#FFFCEE',
            background: ad.brandColor,
            padding: '4px 9px',
            borderRadius: 2,
          }}
        >
          {label}
        </span>
      </div>

      {/* Grid: mark | content */}
      <div className="grid items-start gap-5" style={{ gridTemplateColumns: 'auto 1fr' }}>
        {/* Mark */}
        <div
          className="shrink-0"
          style={{
            padding: 14,
            background: 'var(--pb-coda-mark-bg, rgba(0,0,0,0.025))',
            border: '1px solid var(--pb-line)',
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: ad.mark }} />
        </div>

        {/* Content */}
        <div>
          <div
            className="font-jetbrains mb-1.5"
            style={{
              fontSize: 11,
              letterSpacing: '0.1em',
              color: 'var(--pb-muted)',
            }}
          >
            {ad.brand} · {tagline}
          </div>

          <div
            className="font-fraunces mb-3"
            style={{
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.15,
              color: 'var(--pb-ink)',
              letterSpacing: '-0.015em',
              textWrap: 'balance',
            }}
          >
            {headline}
          </div>

          <div
            className="font-source-serif mb-5.5"
            style={{
              fontSize: 16,
              color: 'var(--pb-ink)',
              lineHeight: 1.55,
              opacity: 0.9,
              marginBottom: 22,
            }}
          >
            {body}
          </div>

          <a
            href={ad.url}
            className="font-jetbrains inline-block uppercase no-underline"
            style={{
              padding: '12px 22px',
              background: ad.brandColor,
              color: '#FFF',
              fontSize: 12,
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            {cta}
          </a>
        </div>
      </div>
    </div>
  )
}
