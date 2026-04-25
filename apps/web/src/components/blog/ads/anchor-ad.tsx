'use client'

import type { AdProps, AdLocaleKey } from './types'
import { useDismissable } from './use-dismissable'
import { DismissButton } from './dismiss-button'

/**
 * Anchor — right rail sponsor ad.
 * Sticky card above key points sidebar. Branded label pill + mark + content.
 */
export function AnchorAd({ ad, locale, onDismiss }: AdProps) {
  const [dismissed, dismiss] = useDismissable('a_' + ad.id, onDismiss)
  if (dismissed) return null

  const L: AdLocaleKey = locale === 'pt-BR' ? 'pt' : 'en'
  const label = L === 'pt' ? ad.label_pt : ad.label_en
  const headline = L === 'pt' ? ad.headline_pt : ad.headline_en
  const body = L === 'pt' ? ad.body_pt : ad.body_en
  const cta = L === 'pt' ? ad.cta_pt : ad.cta_en
  const tagline = L === 'pt' ? ad.tagline_pt : ad.tagline_en

  return (
    <div
      className="relative"
      style={{
        padding: '14px 14px 16px',
        border: '1px solid var(--pb-line)',
        background: 'var(--pb-paper2)',
      }}
    >
      {/* Header: branded pill + dismiss */}
      <div className="mb-2.5 flex items-center justify-between">
        <span
          className="font-jetbrains inline-flex items-center gap-1.5"
          style={{
            fontSize: 9,
            letterSpacing: '0.18em',
            fontWeight: 700,
            color: '#FFFCEE',
            background: ad.brandColor,
            padding: '3px 7px',
            borderRadius: 2,
          }}
        >
          {label}
        </span>
        <DismissButton onClick={dismiss} />
      </div>

      {/* Content link */}
      <a href={ad.url} className="block text-inherit no-underline">
        {/* Brand mark + tagline */}
        <div className="mb-2.5 flex items-start gap-2.5">
          <div
            className="shrink-0"
            dangerouslySetInnerHTML={{ __html: ad.mark }}
          />
          <div
            className="font-jetbrains"
            style={{
              fontSize: 10,
              letterSpacing: '0.04em',
              color: 'var(--pb-muted)',
              lineHeight: 1.4,
              paddingTop: 2,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: 'var(--pb-ink)',
                fontSize: 11,
                marginBottom: 2,
              }}
            >
              {ad.brand}
            </div>
            {tagline}
          </div>
        </div>

        {/* Headline */}
        <div
          className="font-fraunces mb-2"
          style={{
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.22,
            color: 'var(--pb-ink)',
            letterSpacing: '-0.01em',
            textWrap: 'balance',
          }}
        >
          {headline}
        </div>

        {/* Body */}
        <div
          className="font-source-serif mb-3"
          style={{
            fontSize: 13,
            color: 'var(--pb-muted)',
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>

        {/* CTA */}
        <div
          className="font-jetbrains"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: ad.brandColor,
            fontWeight: 600,
            paddingTop: 10,
            borderTop: '1px dashed var(--pb-line)',
          }}
        >
          {cta}
        </div>
      </a>
    </div>
  )
}
