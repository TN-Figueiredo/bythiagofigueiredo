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
  lift,
  confidence,
  stats,
}: WinnerBannerProps) {
  return (
    <div
      data-testid="winner-banner"
      className="rounded-lg border border-[rgba(70,177,126,0.35)] bg-cms-surface overflow-hidden"
    >
      <div className="grid grid-cols-[auto_1fr]">
        {/* Left: Trophy column with green bg */}
        <div className="bg-cms-green-subtle py-[28px] px-[30px] flex flex-col justify-center border-r border-cms-border">
          <Trophy
            size={26}
            className="text-cms-green"
            data-testid="icon-Trophy"
            aria-hidden="true"
          />
          <div className="text-[13px] text-cms-text-dim mt-3 mb-1">Vencedor declarado</div>
          <div className="flex items-center gap-[10px]">
            <VChip label={winnerLabel} size={34} ring />
            <span className={`text-[38px] font-bold font-mono leading-none ${lift > 0 ? 'text-cms-green' : 'text-cms-text'}`} data-testid="winner-lift">
              {lift > 0 ? '+' : ''}{formatPercent(lift)}
            </span>
          </div>
          <div className="text-[12px] text-cms-text-muted mt-2">
            {formatPercent(confidence, 1)} de confiança · aplicado no YouTube
          </div>
        </div>

        {/* Right: 3 stat cells */}
        <div className="py-[24px] px-[28px] grid grid-cols-3 gap-[20px] items-center" data-testid="winner-stats">
          <div className="bg-cms-surface py-[22px] px-[24px]">
            <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[10px]">CTR</div>
            <div className="text-[22px] font-bold font-mono text-cms-text leading-none">
              {formatPercent(stats.ctrBefore)}{' '}
              <span className="text-cms-text-muted">→</span>{' '}
              {formatPercent(stats.ctrAfter)}
            </div>
            <div className="text-[11.5px] text-cms-text-muted mt-2">original → vencedor</div>
          </div>

          <div className="bg-cms-surface py-[22px] px-[24px]">
            <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[10px]">Impressões no teste</div>
            <div className="text-[22px] font-bold font-mono text-cms-text leading-none">
              {formatCompact(stats.totalImpressions)}
            </div>
            <div className="text-[11.5px] text-cms-text-muted mt-2">{stats.abbaCycles} {stats.abbaCycles === 1 ? 'ciclo' : 'ciclos'} ABBA</div>
          </div>

          <div className="bg-cms-surface py-[22px] px-[24px]">
            <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[10px]">Ganho estimado</div>
            {stats.monthlyExtraClicks > 0 ? (
              <>
                <div className="text-[22px] font-bold font-mono leading-none">
                  <span className="text-cms-green">+{formatCompact(stats.monthlyExtraClicks)}</span>
                </div>
                <div className="text-[11.5px] text-cms-text-muted mt-2">cliques/mês a mais</div>
              </>
            ) : (
              <>
                <div className="text-[22px] font-bold font-mono leading-none text-cms-text-muted">—</div>
                <div className="text-[11.5px] text-cms-text-muted mt-2">lift baixo para estimar</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
