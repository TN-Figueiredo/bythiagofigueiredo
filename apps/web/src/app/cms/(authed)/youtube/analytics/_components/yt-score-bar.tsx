import type { Axis } from '@/lib/youtube/scoring-types'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'

interface Props {
  axis: Axis
  score: number
  showLabel?: boolean
}

function getBarColor(score: number): string {
  if (score >= 85) return 'bg-[#34d399]'
  if (score >= 65) return 'bg-[#60a5fa]'
  if (score >= 40) return 'bg-[#fbbf24]'
  return 'bg-[#f87171]'
}

export function YtScoreBar({ axis, score, showLabel = true }: Props) {
  const pct = Math.max(0, Math.min(100, score))

  return (
    <div className="flex items-center gap-2">
      {showLabel && (
        <span className="w-16 text-[10px] text-cms-text-muted truncate">{AXIS_LABELS[axis]}</span>
      )}
      <div className="relative h-1.5 flex-1 rounded-sm bg-cms-border">
        <div
          className={`absolute inset-y-0 left-0 rounded-sm ${getBarColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-[10px] font-medium text-cms-text-muted">
        {Math.round(score)}
      </span>
    </div>
  )
}
