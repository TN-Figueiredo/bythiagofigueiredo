'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { brDec } from '@/lib/youtube/format'
import { VChip } from './ab-primitives'

interface BehaviorStripProps {
  label: DisplayLabel
  color: string
  ctr: number
  maxCtr: number
  isLeader?: boolean
  isBaseline?: boolean
  delta?: number
}

export function BehaviorStrip({ label, color, ctr, maxCtr, isLeader, isBaseline, delta }: BehaviorStripProps) {
  const barWidth = maxCtr > 0 ? Math.min(100, (ctr / maxCtr) * 100) : 0

  return (
    <div className="flex items-center gap-2 py-1">
      <VChip label={label} size={20} ring={isLeader} />
      <div className="flex-1 h-2 rounded-full bg-cms-surface overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-[600ms] ease-out"
          style={{ width: `${barWidth}%`, backgroundColor: color }}
        />
      </div>
      <span className="min-w-[3rem] text-right text-xs font-mono font-bold" style={{ fontFamily: 'var(--font-jetbrains)' }}>
        {brDec(ctr, 2)}%
      </span>
      {!isBaseline && delta != null && (
        <span className={`min-w-[2.5rem] text-right text-2xs font-medium ${delta > 0 ? 'text-cms-green' : delta < 0 ? 'text-red-400' : 'text-cms-text-muted'}`}>
          {delta > 0 ? '+' : ''}{brDec(delta, 0)}%
        </span>
      )}
    </div>
  )
}
