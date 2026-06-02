'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { brDec } from '@/lib/youtube/format'
import { VChip } from './ab-primitives'

export interface RankBarsProps {
  variants: Array<{ label: DisplayLabel; color: string; pBest: number; pTop2: number }>
  metric?: 'pBest' | 'pTop2'
}

export function RankBars({ variants, metric = 'pBest' }: RankBarsProps) {
  if (variants.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-cms-text-muted">
        Nenhuma variante para exibir.
      </div>
    )
  }

  const sorted = [...variants].sort((a, b) => b[metric] - a[metric])

  return (
    <div className="flex flex-col gap-[11px]">
      {sorted.map(v => {
        const raw = v[metric]
        const clamped = Math.min(raw, 1)
        const widthPct = clamped * 100
        const widthStyle = widthPct === 0 ? '2px' : `${widthPct}%`

        return (
          <div key={v.label} className="flex items-center gap-[11px]">
            <VChip label={v.label} size={20} />
            <div className="flex-1 h-[22px] bg-cms-surface-hover rounded-[6px] overflow-hidden relative">
              <div
                data-rank-bar
                className="h-full rounded-[6px]"
                style={{
                  width: widthStyle,
                  background: `linear-gradient(90deg, ${v.color}cc, ${v.color})`,
                  transition: 'width 0.6s cubic-bezier(0.2, 0.7, 0.2, 1)',
                }}
              />
            </div>
            <span className="font-mono text-[13px] font-bold text-cms-text w-[42px] text-right shrink-0">
              {brDec(Math.min(raw, 1) * 100, 0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
