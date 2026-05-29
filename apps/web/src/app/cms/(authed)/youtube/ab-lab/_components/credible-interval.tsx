'use client'

import type { StatsVariant } from '@/lib/youtube/ab-types'
import { VChip } from './ab-primitives'

export interface CredibleIntervalProps {
  variants: StatsVariant[]
  leader?: string
}

function computeCI(ctr: number, impressions: number): { lo: number; hi: number } {
  const sd = Math.sqrt((ctr * (1 - ctr)) / impressions)
  return { lo: ctr - 1.96 * sd, hi: ctr + 1.96 * sd }
}

export function CredibleInterval({ variants, leader }: CredibleIntervalProps) {
  const active = variants.filter(v => v.impressions > 0)

  if (active.length === 0) return null

  // Compute CI for all active variants
  const intervals = active.map(v => ({ ...v, ...computeCI(v.ctr, v.impressions) }))

  // Shared scale: min of all lows, max of all his
  const allLo = intervals.map(i => i.lo)
  const allHi = intervals.map(i => i.hi)
  const scaleMin = Math.min(...allLo)
  const scaleMax = Math.max(...allHi)
  const scaleRange = scaleMax - scaleMin || 1

  function toPercent(value: number) {
    return ((value - scaleMin) / scaleRange) * 100
  }

  return (
    <div className="flex flex-col gap-2">
      {intervals.map(v => {
        const isLeader = leader === v.label
        const bandLeft = toPercent(v.lo)
        const bandRight = 100 - toPercent(v.hi)
        const meanPos = toPercent(v.ctr)

        return (
          <div key={v.label} data-ci-row className="flex items-center gap-2">
            <span data-leader-ring={isLeader ? true : undefined}>
              <VChip label={v.label} ring={isLeader} />
            </span>
            <div className="relative flex-1 h-4 rounded bg-cms-surface overflow-visible">
              {/* CI band */}
              <div
                className="absolute top-1 bottom-1 rounded"
                style={{
                  left: `${bandLeft}%`,
                  right: `${bandRight}%`,
                  backgroundColor: `${v.color}44`,
                  border: `1px solid ${v.color}88`,
                }}
              />
              {/* Mean dot */}
              <div
                data-mean-dot
                className="absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full border-2 border-white"
                style={{
                  left: `${meanPos}%`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: v.color,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
