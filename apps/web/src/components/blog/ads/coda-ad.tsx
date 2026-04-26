'use client'

import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { adLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

export function CodaAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  if (dismissed) return null

  const label = adLabel(creative.type, locale)

  return (
    <div
      className="relative mt-12"
      style={{
        padding: '32px 32px 28px',
        border: '2px solid var(--pb-line)',
        borderTop: `4px solid ${creative.brandColor}`,
        background: 'var(--pb-coda-bg, rgba(0,0,0,0.012))',
      }}
    >
      <div className="absolute right-3.5 top-3.5">
        <DismissButton onClick={dismiss} />
      </div>

      <div className="mb-5">
        <span
          className="font-jetbrains inline-flex items-center gap-1.5"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            fontWeight: 700,
            color: '#FFFCEE',
            background: creative.brandColor,
            padding: '4px 9px',
            borderRadius: 2,
          }}
        >
          {label}
        </span>
      </div>

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: 'auto 1fr' }}>
        {creative.logoUrl && (
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              padding: 14,
              background: 'var(--pb-coda-mark-bg, rgba(0,0,0,0.025))',
              border: '1px solid var(--pb-line)',
            }}
          >
            <img src={creative.logoUrl} alt={`${creative.title} logo`} width={36} height={36} />
          </div>
        )}

        <div>
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
            {creative.title}
          </div>

          <div
            className="font-source-serif"
            style={{
              fontSize: 16,
              color: 'var(--pb-ink)',
              lineHeight: 1.55,
              opacity: 0.9,
              marginBottom: 22,
            }}
          >
            {creative.body}
          </div>

          <a
            href={creative.ctaUrl}
            className="font-jetbrains inline-block uppercase no-underline"
            style={{
              padding: '12px 22px',
              background: creative.brandColor,
              color: '#FFF',
              fontSize: 12,
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            {creative.ctaText}
          </a>
        </div>
      </div>
    </div>
  )
}
