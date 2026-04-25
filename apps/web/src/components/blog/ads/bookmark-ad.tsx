'use client'

import type { AdProps, AdLocaleKey } from './types'
import { useDismissable } from './use-dismissable'
import { DismissButton } from './dismiss-button'

/**
 * Bookmark — paper scrap stuck mid-article.
 * Taped, slightly rotated. Editorial / personal feel.
 * Cream background with dark text for contrast in both themes.
 */
export function BookmarkAd({ ad, locale, onDismiss }: AdProps) {
  const [dismissed, dismiss] = useDismissable('b_' + ad.id, onDismiss)
  if (dismissed) return null

  const L: AdLocaleKey = locale === 'pt-BR' ? 'pt' : 'en'
  const label = L === 'pt' ? ad.label_pt : ad.label_en
  const headline = L === 'pt' ? ad.headline_pt : ad.headline_en
  const body = L === 'pt' ? ad.body_pt : ad.body_en
  const cta = L === 'pt' ? ad.cta_pt : ad.cta_en
  const tagline = L === 'pt' ? ad.tagline_pt : ad.tagline_en

  return (
    <div className="my-11 flex justify-center">
      <div
        className="relative w-full max-w-[540px] dark:bg-[#F2EBDB] bg-[#FFFCEE]"
        style={{
          color: '#1A140C',
          padding: '20px 24px 20px',
          boxShadow:
            'var(--pb-bookmark-shadow, 0 6px 18px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.04))',
          transform: 'rotate(-0.2deg)',
        }}
      >
        {/* Tape decoration */}
        <div
          aria-hidden="true"
          className="absolute left-1/2"
          style={{
            top: -10,
            transform: 'translateX(-50%) rotate(2deg)',
            width: 72,
            height: 18,
            background: 'rgba(255,180,120,0.72)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          }}
        />

        {/* Header: branded label pill + dismiss */}
        <div className="mb-3 flex items-center justify-between">
          <span
            className="font-jetbrains inline-flex items-center gap-1.5"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              fontWeight: 700,
              color: '#FFFCEE',
              background: ad.brandColor,
              padding: '4px 8px',
              borderRadius: 2,
            }}
          >
            {label}
          </span>
          <DismissButton
            onClick={dismiss}
            color="#5A4A3C"
          />
        </div>

        {/* Brand mark + brand line */}
        <div className="mb-3 flex items-center gap-3">
          <div dangerouslySetInnerHTML={{ __html: ad.mark }} />
          <div>
            <div
              className="font-fraunces"
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: '#1A140C',
                lineHeight: 1.1,
                marginBottom: 2,
              }}
            >
              {ad.brand}
            </div>
            <div
              className="font-jetbrains"
              style={{
                fontSize: 10,
                letterSpacing: '0.06em',
                color: '#5A4A3C',
              }}
            >
              {tagline}
            </div>
          </div>
        </div>

        {/* Headline */}
        <div
          className="font-fraunces mb-2.5"
          style={{
            fontSize: 19,
            fontWeight: 500,
            lineHeight: 1.22,
            color: '#1A140C',
            letterSpacing: '-0.01em',
            textWrap: 'balance',
          }}
        >
          {headline}
        </div>

        {/* Body */}
        <div
          className="font-source-serif mb-4"
          style={{
            fontSize: 14,
            color: '#3A2E22',
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>

        {/* CTA button */}
        <a
          href={ad.url}
          className="font-jetbrains inline-block no-underline"
          style={{
            padding: '9px 16px',
            background: '#1A140C',
            color: '#FFFCEE',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {cta}
        </a>
      </div>
    </div>
  )
}
