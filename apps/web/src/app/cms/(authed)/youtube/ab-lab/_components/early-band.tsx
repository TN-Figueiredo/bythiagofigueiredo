'use client'

import { Timer } from 'lucide-react'

export interface EarlyBandProps {
  dayOf: number
  totalDays: number
}

export function EarlyBand({ dayOf, totalDays }: EarlyBandProps) {
  const progress = totalDays > 0 ? Math.min(1, dayOf / totalDays) : 0

  return (
    <div
      data-testid="early-band"
      className="flex items-center gap-[14px] rounded-[14px] border border-cms-border bg-cms-surface py-[16px] px-[20px]"
    >
      {/* Pulsing icon */}
      <span
        className="early-pulse flex items-center justify-center rounded-[9px]"
        style={{ width: 36, height: 36, minWidth: 36 }}
      >
        <Timer size={18} className="text-cms-accent" aria-hidden="true" />
      </span>

      {/* Progress area */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-[6px]">
          <span className="text-[13px] font-semibold text-cms-text">
            Coletando dados iniciais
          </span>
          <span className="mono text-[12px] text-cms-text-dim">
            Dia {dayOf} de {totalDays}
          </span>
        </div>
        <div
          className="h-[5px] rounded-full overflow-hidden"
          style={{ background: 'var(--cms-surface-3, var(--cms-surface-hover))' }}
        >
          <div
            className="early-bar h-full rounded-full"
            style={{
              width: `${Math.max(2, progress * 100)}%`,
              background: 'var(--cms-accent)',
              transition: 'width 0.6s',
            }}
          />
        </div>
      </div>
    </div>
  )
}
