'use client'

import type { AdProps, AdLocaleKey } from './types'
import { useDismissable } from './use-dismissable'
import { AdLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

/**
 * Marginalia — left rail house ad.
 * Small margin note. Quiet, editorial feel.
 * Lives in the TOC rail or below it.
 */
export function MarginaliaAd({ ad, locale, onDismiss }: AdProps) {
  const [dismissed, dismiss] = useDismissable('m_' + ad.id, onDismiss)
  if (dismissed) return null

  const L: AdLocaleKey = locale === 'pt-BR' ? 'pt' : 'en'
  const headline = L === 'pt' ? ad.headline_pt : ad.headline_en
  const body = L === 'pt' ? ad.body_pt : ad.body_en
  const cta = L === 'pt' ? ad.cta_pt : ad.cta_en
  const tagline = L === 'pt' ? ad.tagline_pt : ad.tagline_en

  return (
    <div
      className="relative"
      style={{
        paddingTop: 16,
        marginTop: 16,
        borderTop: '1px dashed var(--pb-line)',
      }}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-1.5">
        <AdLabel ad={ad} L={L} />
        <DismissButton
          onClick={dismiss}
          label={L === 'pt' ? 'Fechar' : 'Close'}
        />
      </div>

      {/* Content link */}
      <a href={ad.url} className="block no-underline">
        <div
          className="font-fraunces mb-1.5"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--pb-ink)',
            lineHeight: 1.25,
            letterSpacing: '-0.005em',
          }}
        >
          {headline}
        </div>
        <div
          className="font-source-serif mb-2"
          style={{
            fontSize: 11,
            color: 'var(--pb-muted)',
            lineHeight: 1.45,
          }}
        >
          {body.split('.')[0] + '.'}
        </div>
        <div
          className="font-jetbrains"
          style={{
            fontSize: 10,
            letterSpacing: '0.06em',
            color: ad.brandColor,
            fontWeight: 600,
          }}
        >
          {cta}
        </div>
      </a>

      {/* Brand line */}
      <div
        className="font-jetbrains mt-1.5"
        style={{
          fontSize: 9,
          color: 'var(--pb-faint)',
          letterSpacing: '0.04em',
        }}
      >
        {ad.brand} · {tagline}
      </div>
    </div>
  )
}
