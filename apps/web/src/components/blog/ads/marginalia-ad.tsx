'use client'

import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { AdLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

export function MarginaliaAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  if (dismissed) return null

  return (
    <div
      className="relative"
      style={{
        paddingTop: 16,
        marginTop: 16,
        borderTop: '1px dashed var(--pb-line)',
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-1.5">
        <AdLabel type={creative.type} locale={locale} brandColor={creative.brandColor} />
        <DismissButton
          onClick={dismiss}
          label={locale === 'pt-BR' ? 'Fechar' : 'Close'}
        />
      </div>

      <a href={creative.ctaUrl} className="block no-underline">
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
          {creative.title}
        </div>
        <div
          className="font-source-serif mb-2"
          style={{
            fontSize: 11,
            color: 'var(--pb-muted)',
            lineHeight: 1.45,
          }}
        >
          {creative.body.split('.')[0] + '.'}
        </div>
        <div
          className="font-jetbrains"
          style={{
            fontSize: 10,
            letterSpacing: '0.06em',
            color: creative.brandColor,
            fontWeight: 600,
          }}
        >
          {creative.ctaText}
        </div>
      </a>
    </div>
  )
}
