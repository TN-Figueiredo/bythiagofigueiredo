'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { SEM_MEDICAO_DE_ENTREGA } from './ab-constants'
import { VChip } from './ab-primitives'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface HeroBandProps {
  leader: { label: DisplayLabel; color: string }
  trend: 'up' | 'flat' | 'down'
  /** Sem impressões medidas: o líder aparece como "—". */
  semMedicao?: boolean
}

export function HeroBand({ leader, trend, semMedicao }: HeroBandProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown
  const trendColor = trend === 'up' ? 'var(--cms-green)' : trend === 'down' ? 'var(--cms-red)' : 'var(--cms-text-muted)'
  const trendLabel = trend === 'up' ? 'Subindo' : trend === 'down' ? 'Descendo' : '—'

  const trendSubtitle = trend === 'up'
    ? `${leader.label} consolidando a liderança`
    : trend === 'down'
      ? `${leader.label} perdendo força`
      : 'sem dados'

  return (
    <div
      className="grid overflow-hidden rounded-[16px] border border-cms-border"
      style={{ gap: 1, background: 'var(--cms-border)', gridTemplateColumns: 'repeat(3, 1fr)' }}
      data-testid="hero-band"
    >
      {/* Líder atual: sem percentual (chance de vencer sobre views foi retirada) */}
      <div className="bg-cms-surface py-[18px] px-[20px] flex flex-col">
        <span className="eyebrow">Líder atual</span>
        <div className="flex items-center gap-[10px] mt-[10px]">
          {semMedicao
            ? <span className="font-mono text-[26px] font-bold leading-none text-cms-text-muted">—</span>
            : <VChip label={leader.label} size={34} ring />}
        </div>
      </div>

      {/* CTR lift vs original: sem medição de entrega não há número */}
      <div className="bg-cms-surface py-[18px] px-[20px] flex flex-col">
        <span className="eyebrow">CTR lift vs original</span>
        <div className="font-mono text-[26px] font-bold leading-none tracking-tight mt-[8px] text-cms-text-muted">—</div>
        <span className="text-[11px] text-cms-text mt-auto">{SEM_MEDICAO_DE_ENTREGA}</span>
      </div>

      {/* Tendência */}
      <div className="bg-cms-surface py-[18px] px-[20px] flex flex-col">
        <span className="eyebrow">Tendência</span>
        <div className="flex items-center gap-[7px] font-mono text-[26px] font-bold leading-none tracking-tight mt-[8px]" style={{ color: trendColor }}>
          {trend !== 'flat' && <TrendIcon size={26} aria-hidden="true" />}
          {trendLabel}
        </div>
        <span className="text-[11px] text-cms-text-dim mt-auto">{trendSubtitle}</span>
      </div>
    </div>
  )
}
