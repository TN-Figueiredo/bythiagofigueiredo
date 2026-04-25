'use client'

import type { SponsorAd, HouseAd, AdLocaleKey } from './types'

type AdLabelProps = {
  ad: SponsorAd | HouseAd
  L: AdLocaleKey
  color?: string
}

/**
 * Small label pill with colored dot + text (e.g. "PATROCINADO", "DA CASA").
 * Used across all ad slot components.
 */
export function AdLabel({ ad, L, color }: AdLabelProps) {
  const label = L === 'pt' ? ad.label_pt : ad.label_en

  return (
    <div
      className="font-jetbrains inline-flex items-center gap-1.5"
      style={{
        fontSize: 9,
        letterSpacing: '0.18em',
        color: color || 'var(--pb-muted)',
        textTransform: 'uppercase',
        fontWeight: 600,
      }}
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: 6,
          height: 6,
          background: ad.brandColor,
        }}
      />
      {label}
    </div>
  )
}
