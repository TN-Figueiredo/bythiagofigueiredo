'use client'

import { STALENESS_THRESHOLDS } from '@/lib/youtube/prompt-types'

interface DataFreshnessBadgeProps {
  snapshotAgeHours: number
}

export function DataFreshnessBadge({ snapshotAgeHours }: DataFreshnessBadgeProps) {
  if (snapshotAgeHours <= STALENESS_THRESHOLDS.warn) return null

  const label = snapshotAgeHours > STALENESS_THRESHOLDS.critical
    ? `Dados muito desatualizados (${Math.round(snapshotAgeHours)}h atrás)`
    : `Dados desatualizados (última sync: ${Math.round(snapshotAgeHours)}h atrás)`

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-400">
      <span aria-hidden="true">&#9888;</span>
      <span>{label}</span>
    </div>
  )
}
