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
  leaderCtr?: number
  originalCtr?: number
}

function GaugeSVG({ value, target }: { value: number; target: number }) {
  const SIZE = 108
  const r = 44
  const C = 2 * Math.PI * r
  const frac = Math.min(value, 100) / 100
  const dashFill = C * frac
  const targetAngle = (target / 100) * 360
  const CX = SIZE / 2
  const CY = SIZE / 2

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={CX} cy={CY} r={r} fill="none" stroke="var(--cms-surface-3)" strokeWidth={8} />
        <circle cx={CX} cy={CY} r={r} fill="none" stroke="var(--cms-accent)" strokeWidth={8} strokeLinecap="round" strokeDasharray={`${dashFill} ${C}`} style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.2,0.7,0.2,1)' }} />
        <line x1={92} y1={CY} x2={104} y2={CY} stroke="var(--cms-green)" strokeWidth={2} transform={`rotate(${targetAngle} ${CX} ${CY})`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-[30px] font-bold leading-none tracking-tight">{Math.round(value)}</span>
        <span className="font-mono text-[18px] font-bold text-cms-text-dim tracking-tight">%</span>
      </div>
    </div>
  )
}

export function HeroBand({ confidence, confidenceTarget, leader, lift, trend, leaderCtr, originalCtr }: HeroBandProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'var(--cms-green)' : trend === 'down' ? 'var(--cms-red)' : 'var(--cms-text-muted)'
  const trendLabel = trend === 'up' ? 'Subindo' : trend === 'down' ? 'Descendo' : '— estavel'

  const warmingUp = confidence < 5
  const ptsToTarget = Math.max(0, Math.ceil(confidenceTarget - confidence))

  const liftSubtitle = leaderCtr != null && originalCtr != null && originalCtr > 0
    ? `${(leaderCtr * 100).toFixed(1).replace('.', ',')}% vs ${(originalCtr * 100).toFixed(1).replace('.', ',')}%`
    : lift !== 0 ? 'vs variante original' : '—'

  const trendSubtitle = trend === 'up'
    ? `${leader.label} consolidando a liderança`
    : trend === 'down'
      ? `${leader.label} perdendo força`
      : 'estavel'

  const cycleCount = Math.max(1, Math.floor(confidence / 15))

  return (
    <div
      className="grid overflow-hidden rounded-[16px] border border-cms-border"
      style={{ gap: 1, background: 'var(--cms-border)', gridTemplateColumns: 'repeat(4, 1fr)' }}
      data-testid="hero-band"
    >
      {/* Cell 1: Confiança + Gauge */}
      <div className="bg-cms-surface py-[18px] px-[20px] flex flex-col">
        <div className="flex items-center gap-[4px] mb-[5px]">
          <span className="eyebrow">Confiança</span>
          {!warmingUp && (
            <span className="relative flex h-[5px] w-[5px] ml-[4px]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--cms-green)' }} />
              <span className="relative inline-flex rounded-full h-[5px] w-[5px]" style={{ background: 'var(--cms-green)' }} />
            </span>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ margin: '6px 0' }}>
          <GaugeSVG value={confidence} target={confidenceTarget} />
        </div>
        <span className="text-[11px] text-cms-text-dim">
          {warmingUp ? 'Coletando dados dos primeiros ciclos...' : `meta ${confidenceTarget}% · faltam ${ptsToTarget} pts`}
        </span>
      </div>

      {/* Cell 2: Líder atual */}
      <div className="bg-cms-surface py-[18px] px-[20px] flex flex-col">
        <span className="eyebrow">Líder atual</span>
        <div className="flex items-center gap-[10px] mt-[10px]">
          <VChip label={leader.label} size={34} ring />
        </div>
        <span className="font-mono text-[13px] mt-[10px]">
          <b>{Math.round(confidence)}%</b>{' '}
          <span className="text-cms-text-dim">{warmingUp ? 'Aguardando dados' : 'chance de vencer'}</span>
        </span>
      </div>

      {/* Cell 3: CTR lift vs original */}
      <div className="bg-cms-surface py-[18px] px-[20px] flex flex-col">
        <span className="eyebrow">CTR lift vs original</span>
        <div className="font-mono text-[26px] font-bold leading-none tracking-tight mt-[8px]" style={{ color: lift > 0 ? 'var(--cms-green)' : 'var(--cms-text-muted)' }}>
          {lift > 0 ? '+' : ''}{formatPercent(lift)}
        </div>
        <span className="text-[11px] text-cms-text-dim mt-auto">{liftSubtitle}</span>
      </div>

      {/* Cell 4: Tendência */}
      <div className="bg-cms-surface py-[18px] px-[20px] flex flex-col">
        <span className="eyebrow">Tendência{confidence >= 5 ? ` (${cycleCount} ciclos)` : ''}</span>
        <div className="flex items-center gap-[7px] font-mono text-[26px] font-bold leading-none tracking-tight mt-[8px]" style={{ color: trendColor }}>
          <TrendIcon size={26} aria-hidden="true" />
          {trendLabel}
        </div>
        <span className="text-[11px] text-cms-text-dim mt-auto">{trendSubtitle}</span>
      </div>
    </div>
  )
}
