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
  const SIZE = 108
  const r = SIZE * 0.39 // ~42
  const C = 2 * Math.PI * r
  const frac = Math.min(value, 100) / 100
  const dashFill = C * frac
  const targetAngle = (target / 100) * 360
  const CX = SIZE / 2
  const CY = SIZE / 2

  return (
    <div className="relative">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={CX} cy={CY} r={r} fill="none" stroke="var(--cms-surface-3)" strokeWidth={7} />
        <circle cx={CX} cy={CY} r={r} fill="none" stroke="var(--cms-accent)" strokeWidth={7} strokeLinecap="round" strokeDasharray={`${dashFill} ${C}`} style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.2,0.7,0.2,1)' }} />
        <line x1={SIZE * 0.85} y1={CY} x2={SIZE * 0.96} y2={CY} stroke="var(--cms-green)" strokeWidth={2} transform={`rotate(${targetAngle} ${CX} ${CY})`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[22px] font-bold leading-none">{Math.round(value)}%</span>
        <span className="text-[8px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">confianca</span>
      </div>
    </div>
  )
}

function StatCell({ eyebrow, children, subtitle }: { eyebrow: string; children: React.ReactNode; subtitle: string }) {
  return (
    <div className="bg-cms-surface py-[20px] px-[22px]">
      <div className="eyebrow mb-[8px]">{eyebrow}</div>
      <div className="font-mono text-[20px] font-bold leading-none">{children}</div>
      <div className="text-[11px] text-cms-text-muted mt-[7px]">{subtitle}</div>
    </div>
  )
}

export function HeroBand({ confidence, confidenceTarget, leader, lift, trend }: HeroBandProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'var(--cms-green)' : trend === 'down' ? 'var(--cms-red)' : 'var(--cms-text-muted)'
  const trendLabel = trend === 'up' ? 'subindo' : trend === 'down' ? 'descendo' : 'estavel'

  const warmingUp = confidence < 5
  const estimatedDays = confidence > 0 ? Math.max(1, Math.ceil((confidenceTarget - confidence) / 2.5)) : '—'

  return (
    <div
      className="grid grid-cols-[auto_1fr_1fr_1fr] overflow-hidden rounded-[16px] border border-cms-border"
      style={{ gap: 1, background: 'var(--cms-border)' }}
      data-testid="hero-band"
    >
      {/* Cell 1: Gauge + probability text */}
      <div className="bg-cms-surface py-[20px] px-[22px] flex items-center gap-[16px]">
        <GaugeSVG value={confidence} target={confidenceTarget} />
        <div>
          <div className="flex items-center gap-[5px] mb-[5px]">
            <span className="eyebrow">Probabilidade de vencer</span>
            <InfoTip text="P-best: a probabilidade Bayesiana desta variante ser a melhor. Quanto maior, mais confianca. Meta: 95% = o motor so declara vencedor acima desse limiar." />
          </div>
          <div className="text-[12px] text-cms-text-dim max-w-[140px] leading-[1.4]">
            {warmingUp ? 'Coletando dados dos primeiros ciclos...' : `Meta ${confidenceTarget}% · faltam ~${estimatedDays} dias no ritmo atual`}
          </div>
        </div>
      </div>

      {/* Cell 2: Lider atual */}
      <StatCell eyebrow="Lider atual" subtitle={warmingUp ? 'Aguardando dados' : `${Math.round(confidence)}% de confianca`}>
        <span className="inline-flex items-center gap-[8px]">
          <VChip label={leader.label} size={26} ring />
          {leader.label === 'A' ? 'Original' : `Variante ${leader.label}`}
        </span>
      </StatCell>

      {/* Cell 3: CTR lift */}
      <StatCell eyebrow="CTR lift vs original" subtitle={lift !== 0 ? 'vs variante original' : '—'}>
        <span style={{ color: lift > 0 ? 'var(--cms-green)' : 'var(--cms-text-muted)' }}>
          {lift > 0 ? '+' : ''}{formatPercent(lift)}
        </span>
      </StatCell>

      {/* Cell 4: Tendencia */}
      <StatCell eyebrow="Tendencia" subtitle={trend === 'flat' ? 'estavel' : trend === 'up' ? 'melhorando' : 'piorando'}>
        <span className="inline-flex items-center gap-[7px]" style={{ color: trendColor }}>
          <TrendIcon size={20} aria-hidden="true" />
          {trendLabel}
        </span>
      </StatCell>
    </div>
  )
}
