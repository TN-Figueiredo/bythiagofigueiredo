'use client'

export interface FunnelRowVariant {
  impressions: number
  clicks: number
  linkClicks?: number
  color: string
}

export interface FunnelRowProps {
  variant: FunnelRowVariant
}

export function FunnelRow({ variant }: FunnelRowProps) {
  const { impressions, clicks, linkClicks, color } = variant

  const hasData = impressions > 0
  const stages = [
    { label: 'Impressões', count: impressions, pct: hasData ? 100 : 0 },
    { label: 'Views (CTR)', count: clicks, pct: hasData ? (clicks / impressions) * 100 : 0 },
    ...(linkClicks !== undefined ? [{ label: 'Link clicks', count: linkClicks, pct: hasData ? (linkClicks / impressions) * 100 : 0 }] : []),
  ]

  return (
    <div className="flex flex-col gap-[7px]">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex items-center gap-[10px]">
          <span className="text-[11px] text-cms-text-dim" style={{ width: 92, flexShrink: 0 }}>
            {stage.label}
          </span>
          <div className="flex-1 h-[14px] rounded-[4px] overflow-hidden" style={{ background: 'var(--cms-surface-hover)' }}>
            <div
              className="h-full rounded-[4px]"
              style={{
                width: stage.pct > 0 ? `${stage.pct}%` : '2px',
                background: color,
                opacity: 0.85,
              }}
            />
          </div>
          <span className="font-mono text-[11.5px] font-semibold text-cms-text text-right" style={{ width: 60, flexShrink: 0 }}>
            {stage.count.toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
    </div>
  )
}
