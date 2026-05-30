'use client'

import type { StatsVariant } from '@/lib/youtube/ab-types'
import { VChip } from './ab-primitives'

export interface CredibleIntervalProps {
  variants: StatsVariant[]
  leader?: string
}

function computeCI(ctr: number, impressions: number): { lo: number; hi: number; sd: number } {
  const clampedCtr = Math.max(0, Math.min(1, ctr))
  const variance = (clampedCtr * (1 - clampedCtr)) / impressions
  const sd = Number.isFinite(variance) && variance >= 0 ? Math.sqrt(variance) : 0
  return { lo: Math.max(0, clampedCtr - 1.96 * sd), hi: Math.min(1, clampedCtr + 1.96 * sd), sd }
}

export function CredibleInterval({ variants, leader }: CredibleIntervalProps) {
  const active = variants.filter(v => v.impressions > 0)

  if (active.length === 0) return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cms-text-dim mb-2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
      <p className="text-xs text-cms-text-muted">Aguardando impressões — os gráficos aparecem quando o teste começar a coletar.</p>
    </div>
  )

  const intervals = active.map(v => ({ ...v, ...computeCI(v.ctr, v.impressions) }))

  const allLo = intervals.map(i => i.lo)
  const allHi = intervals.map(i => i.hi)
  const scaleMin = Math.min(...allLo)
  const scaleMax = Math.max(...allHi)
  const scaleRange = scaleMax - scaleMin || 1

  function toPercent(value: number) {
    return ((value - scaleMin) / scaleRange) * 100
  }

  const scaleTicks = [scaleMin, (scaleMin + scaleMax) / 2, scaleMax]

  return (
    <div>
      <div className="flex flex-col gap-[11px]">
        {intervals.map(v => {
          const isLeader = leader === v.label
          const bandLeft = toPercent(v.lo)
          const bandWidth = toPercent(v.hi) - toPercent(v.lo)
          const meanPos = toPercent(v.ctr)

          return (
            <div key={v.label} data-ci-row className="flex items-center gap-[10px]">
              <VChip label={v.label} size={20} ring={isLeader} />
              <div className="flex-1 relative h-[26px] bg-cms-surface-hover rounded-[7px]">
                {/* CI band */}
                <div
                  className="absolute top-1 bottom-1 rounded-[6px]"
                  style={{
                    left: `${bandLeft}%`,
                    width: `${bandWidth}%`,
                    background: `linear-gradient(90deg, ${v.color}33, ${v.color}55, ${v.color}33)`,
                    border: `1px solid ${v.color}66`,
                  }}
                />
                {/* Mean dot */}
                <div
                  data-mean-dot
                  className="absolute top-1/2"
                  style={{
                    left: `${meanPos}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 11,
                    height: 11,
                    borderRadius: 99,
                    backgroundColor: v.color,
                    border: '2px solid var(--cms-surface)',
                    boxShadow: `${v.color} 0px 0px 0px 2px`,
                  }}
                />
              </div>
              {/* Value + ±SD */}
              <span className="font-mono text-[13px] font-bold text-cms-text w-[78px] text-right shrink-0">
                {(v.ctr * 100).toFixed(1)}%
                <span className="text-cms-text-muted font-medium text-[10.5px]">
                  {' '}±{(v.sd * 100).toFixed(1)}
                </span>
              </span>
            </div>
          )
        })}
      </div>
      {/* X-axis scale */}
      <div className="flex mt-[10px]">
        <span className="w-[30px]" />
        <div className="flex-1 flex justify-between">
          {scaleTicks.map((tick, i) => (
            <span key={i} className="font-mono text-[9.5px] text-cms-text-muted">
              {(tick * 100).toFixed(1)}%
            </span>
          ))}
        </div>
        <span className="w-[78px] text-right font-mono text-[9.5px] text-cms-text-muted">CTR</span>
      </div>
    </div>
  )
}
