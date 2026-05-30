'use client'

import { Lock } from 'lucide-react'

export interface LockCountdownProps {
  dayOf: number
  durationDays: number
  confidence: number
  confidenceTarget: number
  cyclesCompleted: number
}

export function LockCountdown({
  dayOf,
  durationDays,
  confidence,
  confidenceTarget,
  cyclesCompleted,
}: LockCountdownProps) {
  const progress = Math.min(100, durationDays > 0 ? (dayOf / durationDays) * 100 : 0)
  const daysRemaining = Math.max(0, durationDays - dayOf)
  const estimatedDays = confidence > 0 ? Math.ceil(((confidenceTarget - confidence) / 2.5)) : daysRemaining
  const totalCycles = durationDays > 0 ? Math.ceil(durationDays / 2) * 2 : 0
  const cyclesRemaining = Math.max(0, totalCycles - cyclesCompleted)

  const estimatedDate = new Date()
  estimatedDate.setDate(estimatedDate.getDate() + Math.max(0, estimatedDays))
  const dateStr = estimatedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <div
      className="flex items-center justify-between gap-[20px] flex-wrap rounded-[12px] bg-cms-surface border border-cms-border"
      style={{ padding: '13px 18px' }}
    >
      {/* Left: Lock icon + text */}
      <div className="flex items-center gap-[11px]">
        <span className="size-[30px] rounded-[8px] bg-cms-surface-hover flex items-center justify-center text-cms-text-dim">
          <Lock size={15} aria-hidden="true" />
        </span>
        <div>
          <div className="text-[13px] font-semibold text-cms-text">Teste travado</div>
          <div className="text-[11.5px] text-cms-text-dim">Variantes fixas até concluir — sem edição no meio do caminho.</div>
        </div>
      </div>

      {/* Right: progress + countdown */}
      <div className="flex items-center gap-[18px]">
        {/* Progress bar */}
        <div className="min-w-[190px]">
          <div className="flex items-center justify-between mb-[5px]">
            <span className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">Conclusão estimada</span>
            <span className="text-[10px] text-cms-text-muted">sem playoff</span>
          </div>
          <div className="h-[6px] bg-cms-surface-hover rounded-full overflow-hidden">
            <div className="h-full bg-cms-accent rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Countdown */}
        <div className="text-right border-l border-cms-border pl-[18px]">
          <div className="flex items-baseline gap-[6px] justify-end">
            <span className="font-mono text-[22px] font-bold text-cms-accent leading-none">
              ~{Math.max(1, estimatedDays)}
            </span>
            <span className="text-[12px] text-cms-text-dim">dias</span>
          </div>
          <div className="font-mono text-[10.5px] text-cms-text-muted mt-[5px]">
            {dateStr} · {cyclesRemaining} ciclos restantes
          </div>
        </div>
      </div>
    </div>
  )
}
