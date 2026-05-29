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

const OPACITIES = [1, 0.65, 0.4]

interface Stage {
  label: string
  count: number
  widthPx?: string
  widthPct?: number
}

export function FunnelRow({ variant }: FunnelRowProps) {
  const { impressions, clicks, linkClicks, color } = variant

  const stages: Stage[] = [
    { label: 'Impressions', count: impressions },
    { label: 'Clicks', count: clicks },
    ...(linkClicks !== undefined ? [{ label: 'Link clicks', count: linkClicks }] : []),
  ]

  return (
    <div className="flex flex-col gap-1">
      {stages.map((stage, i) => {
        const frac = impressions === 0 ? 0 : stage.count / impressions
        const pct = Math.min(frac * 100, 100)
        const widthStyle = impressions === 0 || pct === 0 ? '3px' : `${pct}%`

        return (
          <div key={stage.label} className="flex items-center gap-2">
            <span className="text-2xs text-cms-text-muted w-20 shrink-0 text-right">
              {stage.label}
            </span>
            <div className="flex-1 h-4 relative">
              <div
                data-funnel-bar
                className="h-full rounded"
                style={{
                  width: widthStyle,
                  backgroundColor: color,
                  opacity: OPACITIES[i] ?? 0.3,
                }}
              />
            </div>
            <span className="text-2xs font-mono text-cms-text-muted w-14 shrink-0">
              {stage.count.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}
