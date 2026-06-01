'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'
import { VChip, InfoTip } from './ab-primitives'
import { TrendingUp, Minus, TrendingDown } from 'lucide-react'

export interface HeroBandProps {
  confidence: number
  confidenceTarget: number
  leader: { label: DisplayLabel; color: string }
  lift: number
  trend: 'up' | 'flat' | 'down'
}

function GaugeSVG({ value, target }: { value: number; target: number }) {
  const r = 42
  const C = 2 * Math.PI * r
  const frac = Math.min(value, 100) / 100
  const dashFill = C * frac
  const targetAngle = (target / 100) * 360

  return (
    <div className="relative">
      <svg width={104} height={104} viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={52} cy={52} r={r} fill="none" stroke="var(--cms-surface-3)" strokeWidth={8} />
        <circle cx={52} cy={52} r={r} fill="none" stroke="var(--cms-accent)" strokeWidth={8} strokeLinecap="round" strokeDasharray={`${dashFill} ${C}`} style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.2,0.7,0.2,1)' }} />
        <line x1={88} y1={52} x2={100} y2={52} stroke="var(--cms-green)" strokeWidth={2} transform={`rotate(${targetAngle} 52 52)`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[24px] font-bold leading-none">{Math.round(value)}%</span>
        <span className="text-[8px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">confiança</span>
      </div>
    </div>
  )
}

function StatCell({ eyebrow, children, subtitle }: { eyebrow: string; children: React.ReactNode; subtitle: string }) {
  return (
    <div className="bg-cms-surface py-[22px] px-[24px]">
      <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[10px]">{eyebrow}</div>
      <div className="font-mono text-[22px] font-bold leading-none">{children}</div>
      <div className="text-[11.5px] text-cms-text-muted mt-[8px]">{subtitle}</div>
    </div>
  )
}

export function HeroBand({ confidence, confidenceTarget, leader, lift, trend }: HeroBandProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'var(--cms-green)' : trend === 'down' ? 'var(--cms-red)' : 'var(--cms-text-muted)'
  const trendLabel = trend === 'up' ? 'subindo' : trend === 'down' ? 'descendo' : 'estável'

  const estimatedDays = confidence > 0 ? Math.max(1, Math.ceil((confidenceTarget - confidence) / 2.5)) : '—'

  return (
    <div
      className="grid grid-cols-[auto_1fr_1fr_1fr] overflow-hidden rounded-[16px] border border-cms-border"
      style={{ gap: 1, background: 'var(--cms-border)' }}
      data-testid="hero-band"
    >
      {/* Cell 1: Gauge + probability text */}
      <div className="bg-cms-surface py-[22px] px-[26px] flex items-center gap-[18px]">
        <GaugeSVG value={confidence} target={confidenceTarget} />
        <div>
          <div className="flex items-center gap-[5px] mb-[6px]">
            <span className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">Probabilidade de vencer</span>
            <InfoTip text="P-best: a probabilidade Bayesiana desta variante ser a melhor. Quanto maior, mais confiança. Meta: 95% = o motor só declara vencedor acima desse limiar." />
          </div>
          <div className="text-[12.5px] text-cms-text-dim max-w-[150px] leading-[1.4]">
            Meta {confidenceTarget}% · faltam ~{estimatedDays} dias no ritmo atual
          </div>
        </div>
      </div>

      {/* Cell 2: Líder atual */}
      <StatCell eyebrow="Líder atual" subtitle={`${Math.round(confidence)}% de confiança`}>
        <span className="inline-flex items-center gap-[9px]">
          <VChip label={leader.label} size={28} ring />
          {leader.label === 'A' ? 'Original' : `Variante ${leader.label}`}
        </span>
      </StatCell>

      {/* Cell 3: CTR lift */}
      <StatCell eyebrow="CTR lift vs original" subtitle={lift !== 0 ? 'vs variante original' : '—'}>
        <span style={{ color: lift > 0 ? 'var(--cms-green)' : 'var(--cms-text-muted)' }}>
          {lift > 0 ? '+' : ''}{formatPercent(lift)}
        </span>
      </StatCell>

      {/* Cell 4: Tendência */}
      <StatCell eyebrow="Tendência" subtitle={trend === 'flat' ? 'estável' : trend === 'up' ? 'melhorando' : 'piorando'}>
        <span className="inline-flex items-center gap-[8px]" style={{ color: trendColor }}>
          <TrendIcon size={22} aria-hidden="true" />
          {trendLabel}
        </span>
      </StatCell>
    </div>
  )
}
