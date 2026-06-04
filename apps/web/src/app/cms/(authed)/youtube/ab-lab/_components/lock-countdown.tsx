'use client'

import { Lock } from 'lucide-react'

export interface LockCountdownProps {
  dayOf: number
  durationDays: number
  confidence: number
  confidenceTarget: number
  cyclesCompleted: number
  createdAt?: string
  hasPlayoff?: boolean
}

export function LockCountdown({
  dayOf,
  durationDays,
  confidence,
  confidenceTarget,
  cyclesCompleted,
  createdAt,
  hasPlayoff,
}: LockCountdownProps) {
  const progress = Math.min(100, durationDays > 0 ? (dayOf / durationDays) * 100 : 0)
  const estimatedDays = confidence > 0 ? Math.ceil(((confidenceTarget - confidence) / 2.5)) : Math.max(0, durationDays - dayOf)
  const totalCycles = durationDays > 0 ? Math.ceil(durationDays / 2) * 2 : 0
  const cyclesRemaining = Math.max(0, totalCycles - cyclesCompleted)

  const startDate = createdAt
    ? new Date(createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="rounded-[12px] bg-cms-surface border border-cms-border px-[18px] py-[14px]">
      <div className="flex gap-[12px]">
        <Lock size={16} className="text-cms-text-dim shrink-0 mt-[1px]" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {/* Row 1: title + countdown */}
          <div className="flex items-center justify-between gap-[12px] mb-[8px]">
            <span className="text-[13px] font-semibold text-cms-text">
              Teste travado até atingir os critérios de resolução
            </span>
            <span className="font-mono text-[12px] text-cms-text-dim shrink-0">
              ~{Math.max(1, estimatedDays)} dias · {cyclesRemaining} ciclos restantes
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-[5px] bg-cms-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-cms-accent rounded-full transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Row 2: start date + playoff status */}
          <div className="flex items-center justify-between gap-[12px] mt-[7px]">
            {startDate && (
              <span className="text-[11px] text-cms-text-dim">Começou {startDate}</span>
            )}
            <span className="text-[11px] text-cms-text-dim">
              {hasPlayoff ? 'Playoff agendado' : 'Sem playoff agendado'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
