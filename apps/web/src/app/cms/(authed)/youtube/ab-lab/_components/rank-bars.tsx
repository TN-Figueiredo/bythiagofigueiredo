'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'

export interface RankBarsProps {
  variants: Array<{ label: DisplayLabel; color: string; pBest: number; pTop2: number }>
  metric?: 'pBest' | 'pTop2'
}

export function RankBars({ variants, metric = 'pBest' }: RankBarsProps) {
  const sorted = [...variants].sort((a, b) => b[metric] - a[metric])

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map(v => {
        const raw = v[metric]
        const clamped = Math.min(raw, 1)
        const widthPct = clamped * 100
        // Use inline style with max() equivalent: at least 2px
        const widthStyle = widthPct === 0 ? '2px' : `${widthPct}%`

        return (
          <div key={v.label} className="flex items-center gap-2">
            <span data-rank-label className="w-4 text-xs font-mono font-bold text-cms-text shrink-0">
              {v.label}
            </span>
            <div className="flex-1 relative h-5 bg-cms-surface rounded overflow-hidden">
              <div
                data-rank-bar
                className="h-full rounded"
                style={{
                  width: widthStyle,
                  backgroundColor: v.color,
                }}
              />
            </div>
            <span className="text-2xs font-mono text-cms-text-muted w-10 text-right shrink-0">
              {(Math.min(raw, 1) * 100).toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
