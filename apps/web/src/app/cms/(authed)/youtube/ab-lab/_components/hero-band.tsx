'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'
import { VChip } from './ab-primitives'
import { Gauge } from './gauge'
import { TrendingUp, Minus, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface HeroBandProps {
  confidence: number
  confidenceTarget: number
  leader: { label: DisplayLabel; color: string }
  lift: number
  trend: 'up' | 'flat' | 'down'
}

const TREND_ICON: Record<string, LucideIcon> = {
  up: TrendingUp,
  flat: Minus,
  down: TrendingDown,
}

const TREND_TESTID: Record<string, string> = {
  up: 'icon-TrendingUp',
  flat: 'icon-Minus',
  down: 'icon-TrendingDown',
}

export function HeroBand({ confidence, confidenceTarget, leader, lift, trend }: HeroBandProps) {
  const TrendIcon = TREND_ICON[trend] ?? Minus

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-4" data-testid="hero-band">
      {/* Cell 1: Confidence gauge */}
      <div className="flex flex-col items-center justify-center gap-1" data-testid="hero-cell">
        <div className="w-16 h-16">
          <Gauge value={confidence} target={confidenceTarget} ariaLabel="Confidence" />
        </div>
        <span className="text-2xs text-cms-text-dim">Confidence</span>
      </div>

      {/* Cell 2: Leader */}
      <div className="flex flex-col items-center justify-center gap-1" data-testid="hero-cell">
        <VChip label={leader.label} size={28} />
        <span className="text-2xs text-cms-text-dim">Leader</span>
      </div>

      {/* Cell 3: Lift */}
      <div className="flex flex-col items-center justify-center gap-1" data-testid="hero-cell">
        <span className="text-sm font-bold text-cms-green font-mono" data-testid="lift-value">
          {lift > 0 ? '+' : ''}{formatPercent(lift)}
        </span>
        <span className="text-2xs text-cms-text-dim">Lift</span>
      </div>

      {/* Cell 4: Trend */}
      <div className="flex flex-col items-center justify-center gap-1" data-testid="hero-cell">
        <TrendIcon size={20} data-testid={TREND_TESTID[trend]} aria-hidden="true" />
        <span className="text-2xs text-cms-text-dim">Trend</span>
      </div>
    </div>
  )
}
