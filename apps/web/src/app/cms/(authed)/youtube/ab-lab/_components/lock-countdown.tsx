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
  const needsMore = confidence < confidenceTarget

  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-cms-text">
        <Lock size={14} aria-hidden="true" data-testid="icon-Lock" />
        <span className="font-medium">Test locked</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-cms-surface overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Test progress">
        <div
          className="h-full rounded-full bg-cms-accent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-2xs text-cms-text-muted">
        <span>
          {daysRemaining > 0
            ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`
            : 'Duration reached'}
          {needsMore && ' — awaiting significance'}
        </span>
        <span>{cyclesCompleted} cycle{cyclesCompleted !== 1 ? 's' : ''} completed</span>
      </div>
    </div>
  )
}
