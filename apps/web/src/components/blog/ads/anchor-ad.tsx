'use client'

import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { adLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

export function AnchorAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  if (dismissed) return null

  const label = adLabel(creative.type, locale)

  return (
    <div
      className="relative"
      style={{
        padding: '14px 14px 16px',
        border: '1px solid var(--pb-line)',
        background: 'var(--pb-paper2)',
      }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span
          className="font-jetbrains inline-flex items-center gap-1.5"
          style={{
            fontSize: 9,
            letterSpacing: '0.18em',
            fontWeight: 700,
            color: '#FFFCEE',
            background: creative.brandColor,
            padding: '3px 7px',
            borderRadius: 2,
          }}
        >
          {label}
        </span>
        <DismissButton onClick={dismiss} />
      </div>

      <a href={creative.ctaUrl} className="block text-inherit no-underline">
        <div className="mb-2.5 flex items-start gap-2.5">
          {creative.logoUrl && (
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                background: creative.brandColor,
              }}
            >
              <img src={creative.logoUrl} alt="" width={28} height={28} />
            </div>
          )}
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
              {creative.title.split(' ').slice(0, 3).join(' ')}
            </div>
          </div>
        </div>

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
          {creative.title}
        </div>

        <div
          className="font-source-serif mb-3"
          style={{
            fontSize: 13,
            color: 'var(--pb-muted)',
            lineHeight: 1.5,
          }}
        >
          {creative.body}
        </div>

        <div
          className="font-jetbrains"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: creative.brandColor,
            fontWeight: 600,
            paddingTop: 10,
            borderTop: '1px dashed var(--pb-line)',
          }}
        >
          {creative.ctaText}
        </div>
      </a>
    </div>
  )
}
