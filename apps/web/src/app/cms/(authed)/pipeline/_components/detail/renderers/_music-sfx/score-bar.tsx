import { computeScorePercent, getScoreColor } from './score-utils'

interface ScoreBarProps {
  score: number
  max: number
}

export function ScoreBar({ score, max }: ScoreBarProps) {
  if (max === 0) return null
  const pct = computeScorePercent(score, max)
  const color = getScoreColor(score, max)

  return (
    <div className="flex items-center gap-1 flex-shrink-0" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Score ${pct}%`}>
      <div
        className="rounded-sm overflow-hidden"
        style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-sm"
          style={{ width: `${Math.min(pct, 100)}%`, background: color }}
        />
      </div>
      <span className="text-[9px] font-bold" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
        {pct}<span className="text-[7px]">%</span>
      </span>
    </div>
  )
}
