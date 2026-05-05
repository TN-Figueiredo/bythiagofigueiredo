'use client'

import type { AdSlotProps } from '@/components/blog/ads/types'
import { useDismissable } from '@/components/blog/ads/use-dismissable'
import { adLabel } from '@/components/blog/ads/ad-label'

interface HorizontalAnchorProps extends AdSlotProps {
  dark?: boolean
}

export function HorizontalAnchor({ creative, locale, dark = false }: HorizontalAnchorProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  if (dismissed) return null

  const line = dark ? '#2E2718' : '#CEBFA0'
  const ink = dark ? '#EFE6D2' : '#161208'
  const muted = dark ? '#958A75' : '#6A5F48'
  const faint = dark ? '#6B634F' : '#9C9178'
  const bg = dark ? '#1E1A12' : '#F3EAD4'
  const label = adLabel(creative.type, locale)

  return (
    <div
      data-slot-key="archive:break:anchor"
      style={{
        background: bg,
        borderTop: `1px dashed ${line}`,
        borderBottom: `1px dashed ${line}`,
        padding: '18px 22px 20px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 28,
        alignItems: 'center',
      }}
    >
      {/* Left: brand mark + label + brand name */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingRight: 28,
          borderRight: `1px dashed ${line}`,
        }}
      >
        {creative.logoUrl && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 4,
              background: creative.brandColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img
              src={creative.logoUrl}
              alt={`${creative.title} logo`}
              width={24}
              height={24}
            />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div
            className="font-jetbrains"
            style={{
              fontSize: 9,
              letterSpacing: '0.18em',
              color: muted,
              textTransform: 'uppercase',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: creative.brandColor,
                display: 'inline-block',
              }}
            />
            {label}
          </div>
          <div
            className="font-jetbrains"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: ink,
              letterSpacing: '0.02em',
            }}
          >
            {creative.title.split(' ').slice(0, 3).join(' ')}
          </div>
          {creative.body && (
            <div
              className="font-jetbrains"
              style={{
                fontSize: 9.5,
                color: faint,
                letterSpacing: '0.02em',
              }}
            >
              {creative.body.split(' ').slice(0, 5).join(' ')}
            </div>
          )}
        </div>
      </div>

      {/* Middle: headline + body */}
      <div style={{ minWidth: 0 }}>
        <div
          className="font-fraunces"
          style={{
            fontSize: 19,
            fontWeight: 500,
            lineHeight: 1.25,
            color: ink,
            letterSpacing: '-0.01em',
            textWrap: 'balance',
            marginBottom: 4,
          }}
        >
          {creative.title}
        </div>
        <div
          className="font-source-serif"
          style={{
            fontSize: 13.5,
            color: muted,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {creative.body}
        </div>
      </div>

      {/* Right: dismiss + CTA */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
        }}
      >
        <button
          onClick={dismiss}
          aria-label={locale === 'pt-BR' ? 'Fechar anúncio' : 'Dismiss ad'}
          className="cursor-pointer border-none bg-transparent leading-none transition-opacity duration-150 hover:opacity-100"
          style={{
            color: faint,
            fontSize: 16,
            opacity: 0.55,
            padding: '2px 4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.55'
          }}
        >
          ×
        </button>
        <a
          href={creative.ctaUrl}
          className="font-jetbrains no-underline"
          style={{
            padding: '8px 14px',
            border: `1px solid ${creative.brandColor}`,
            color: creative.brandColor,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {creative.ctaText}
        </a>
      </div>

      {/* Mobile responsive override */}
      <style>{`
        @media (max-width: 767px) {
          [data-slot-key="archive:break:anchor"] {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          [data-slot-key="archive:break:anchor"] > div:first-child {
            border-right: none !important;
            padding-right: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
