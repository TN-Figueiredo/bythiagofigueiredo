'use client'

export function adLabel(type: 'house' | 'cpa', locale: 'en' | 'pt-BR'): string {
  if (type === 'cpa') return locale === 'pt-BR' ? 'PATROCINADO' : 'SPONSORED'
  return locale === 'pt-BR' ? 'DA CASA' : 'HOUSE'
}

type AdLabelProps = {
  type: 'house' | 'cpa'
  locale: 'en' | 'pt-BR'
  brandColor: string
  color?: string
}

export function AdLabel({ type, locale, brandColor, color }: AdLabelProps) {
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
          background: brandColor,
        }}
      />
      {adLabel(type, locale)}
    </div>
  )
}
