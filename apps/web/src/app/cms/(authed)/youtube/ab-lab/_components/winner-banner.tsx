'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { formatPercent, formatNumber, formatCompact } from './ab-constants'
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
      className="rounded-[var(--cms-radius)] border-2 border-cms-green bg-cms-green/5 p-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Trophy + VChip + lift + confidence */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-0.5">
            <Trophy
              size={28}
              className="text-cms-green shrink-0"
              data-testid="icon-Trophy"
              aria-hidden="true"
            />
            <span className="text-2xs text-cms-green font-medium">Vencedor declarado</span>
          </div>
          <VChip label={winnerLabel} size={28} />
          <div className="flex flex-col">
            <span
              className="text-2xl font-bold font-mono text-cms-green"
              data-testid="winner-lift"
            >
              {lift > 0 ? '+' : ''}
              {formatPercent(lift)}
            </span>
            <span className="text-2xs text-cms-text-muted">
              {formatPercent(confidence, 1)} confidence
            </span>
          </div>
        </div>

        {/* Right: 3 stat cells */}
        <div className="flex gap-6" data-testid="winner-stats">
          <div className="flex flex-col items-center">
            <span className="text-sm font-mono font-semibold text-cms-text">
              {formatCompact(stats.totalImpressions)}
            </span>
            <span className="text-2xs text-cms-text-dim">Impressões no teste</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-mono font-semibold text-cms-text">
              {formatNumber(stats.abbaCycles)}
            </span>
            <span className="text-2xs text-cms-text-dim">Ciclos ABBA</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-mono font-semibold text-cms-text">
              {formatCompact(stats.monthlyExtraClicks)}
            </span>
            <span className="text-2xs text-cms-text-dim">Cliques/mês a mais</span>
          </div>
        </div>
      </div>
    </div>
  )
}
