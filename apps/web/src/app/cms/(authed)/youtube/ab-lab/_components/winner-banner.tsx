'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { formatPercent, formatCompact } from './ab-constants'
import { VChip } from './ab-primitives'
import { Trophy } from 'lucide-react'

export interface WinnerBannerProps {
  winnerLabel: DisplayLabel
  winnerColor: string
  lift: number
  confidence: number
  stats: {
    ctrBefore: number
    ctrAfter: number
    totalImpressions: number
    abbaCycles: number
    monthlyExtraClicks: number
  }
}

export function WinnerBanner({
  winnerLabel,
  winnerColor,
  lift,
  confidence,
  stats,
}: WinnerBannerProps) {
  return (
    <div
      data-testid="winner-banner"
      className="rounded-lg border border-cms-green/20 bg-cms-green/5 p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left: Trophy + VChip + lift + confidence */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <Trophy
              size={32}
              className="text-cms-green"
              data-testid="icon-Trophy"
              aria-hidden="true"
            />
            <span className="text-2xs text-cms-green font-medium whitespace-nowrap">Vencedor declarado</span>
          </div>
          <div className="flex items-center gap-2">
            <VChip label={winnerLabel} size={32} ring />
            <div className="flex flex-col">
              <span
                className="text-4xl font-bold font-mono text-cms-green leading-none"
                data-testid="winner-lift"
              >
                {lift > 0 ? '+' : ''}
                {formatPercent(lift)}
              </span>
              <span className="text-2xs text-cms-text-muted mt-1">
                {formatPercent(confidence, 1)} de confiança · aplicado no YouTube
              </span>
            </div>
          </div>
        </div>

        {/* Right: 3 stat cells with headers */}
        <div className="flex gap-8 lg:gap-10" data-testid="winner-stats">
          {/* CTR before → after */}
          <div className="flex flex-col">
            <span className="text-3xs font-medium text-cms-text-dim uppercase tracking-wider mb-1">CTR</span>
            <span className="text-lg font-mono font-semibold text-cms-text leading-tight">
              {formatPercent(stats.ctrBefore)}
              <span className="text-cms-text-muted mx-1">→</span>
              {formatPercent(stats.ctrAfter)}
            </span>
            <span className="text-2xs text-cms-text-dim mt-0.5">original → vencedor</span>
          </div>

          {/* Impressões no teste */}
          <div className="flex flex-col">
            <span className="text-3xs font-medium text-cms-text-dim uppercase tracking-wider mb-1">Impressões no teste</span>
            <span className="text-lg font-mono font-semibold text-cms-text leading-tight">
              {formatCompact(stats.totalImpressions)}
            </span>
            <span className="text-2xs text-cms-text-dim mt-0.5">
              {stats.abbaCycles} ciclos ABBA
            </span>
          </div>

          {/* Ganho estimado */}
          <div className="flex flex-col">
            <span className="text-3xs font-medium text-cms-text-dim uppercase tracking-wider mb-1">Ganho estimado</span>
            <span className="text-lg font-mono font-bold text-cms-green leading-tight">
              +{formatCompact(stats.monthlyExtraClicks)}
            </span>
            <span className="text-2xs text-cms-text-dim mt-0.5">cliques/mês a mais</span>
          </div>
        </div>
      </div>
    </div>
  )
}
