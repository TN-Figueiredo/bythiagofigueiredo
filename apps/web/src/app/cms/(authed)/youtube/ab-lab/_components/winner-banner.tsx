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
      className="fade-in rounded-[16px] overflow-hidden"
      style={{
        border: '1px solid rgba(70,177,126,0.3)',
        background: 'linear-gradient(120deg, var(--cms-green-soft, rgba(70,177,126,0.13)), var(--cms-surface))',
      }}
    >
      <div className="grid grid-cols-[auto_1fr_1fr_1fr]" style={{ gap: 1, background: 'var(--cms-border)' }}>
        {/* Col 1: Trophy + winner VChip + lift */}
        <div className="bg-cms-surface py-[24px] px-[26px] flex flex-col justify-center"
          style={{ background: 'var(--cms-green-subtle)' }}
        >
          <Trophy
            size={24}
            className="text-cms-green"
            data-testid="icon-Trophy"
            aria-hidden="true"
          />
          <div className="text-[12px] text-cms-text-dim mt-3 mb-1">Vencedor declarado</div>
          <div className="flex items-center gap-[9px]">
            <VChip label={winnerLabel} size={32} ring />
            <span
              className="text-[24px] font-bold font-mono leading-none"
              style={{ color: lift > 0 ? 'var(--cms-green)' : 'var(--cms-text)' }}
              data-testid="winner-lift"
            >
              {lift > 0 ? '+' : ''}{formatPercent(lift)}
            </span>
          </div>
          <div className="text-[11.5px] text-cms-text-muted mt-2">
            {formatPercent(confidence, 1)} de confianca · aplicado no YouTube
          </div>
        </div>

        {/* Col 2: CTR */}
        <div className="bg-cms-surface py-[22px] px-[22px]">
          <div className="eyebrow mb-[8px]">CTR</div>
          <div className="text-[24px] font-bold font-mono text-cms-text leading-none tnum">
            {formatPercent(stats.ctrBefore)}{' '}
            <span className="text-cms-text-muted">→</span>{' '}
            {formatPercent(stats.ctrAfter)}
          </div>
          <div className="text-[11px] text-cms-text-muted mt-2">original → vencedor</div>
        </div>

        {/* Col 3: Impressoes */}
        <div className="bg-cms-surface py-[22px] px-[22px]">
          <div className="eyebrow mb-[8px]">Impressoes no teste</div>
          <div className="text-[24px] font-bold font-mono text-cms-text leading-none tnum">
            {formatCompact(stats.totalImpressions)}
          </div>
          <div className="text-[11px] text-cms-text-muted mt-2">{stats.abbaCycles} {stats.abbaCycles === 1 ? 'ciclo' : 'ciclos'} ABBA</div>
        </div>

        {/* Col 4: Ganho estimado */}
        <div className="bg-cms-surface py-[22px] px-[22px]">
          <div className="eyebrow mb-[8px]">Ganho estimado</div>
          {stats.monthlyExtraClicks > 0 ? (
            <>
              <div className="text-[24px] font-bold font-mono leading-none tnum">
                <span className="text-cms-green">+{formatCompact(stats.monthlyExtraClicks)}</span>
              </div>
              <div className="text-[11px] text-cms-text-muted mt-2">cliques/mes a mais</div>
            </>
          ) : (
            <>
              <div className="text-[24px] font-bold font-mono leading-none text-cms-text-muted tnum">—</div>
              <div className="text-[11px] text-cms-text-muted mt-2">lift baixo para estimar</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
