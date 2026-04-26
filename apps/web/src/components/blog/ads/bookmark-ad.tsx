'use client'

import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { adLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

export function BookmarkAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  if (dismissed) return null

  const label = adLabel(creative.type, locale)

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

        <div className="mb-3 flex items-center justify-between">
          <span
            className="font-jetbrains inline-flex items-center gap-1.5"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              fontWeight: 700,
              color: '#FFFCEE',
              background: creative.brandColor,
              padding: '4px 8px',
              borderRadius: 2,
            }}
          >
            {label}
          </span>
          <DismissButton onClick={dismiss} color="#5A4A3C" />
        </div>

        <div className="mb-3 flex items-center gap-3">
          {creative.logoUrl && (
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                background: creative.brandColor,
              }}
            >
              <img src={creative.logoUrl} alt="" width={32} height={32} />
            </div>
          )}
        </div>

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
          {creative.title}
        </div>

        <div
          className="font-source-serif mb-4"
          style={{
            fontSize: 14,
            color: '#3A2E22',
            lineHeight: 1.5,
          }}
        >
          {creative.body}
        </div>

        <a
          href={creative.ctaUrl}
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
          {creative.ctaText}
        </a>
      </div>
    </div>
  )
}
