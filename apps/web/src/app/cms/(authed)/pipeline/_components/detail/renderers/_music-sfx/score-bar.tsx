import { getScoreColor } from './score-utils'

interface ScoreBarProps {
  score: number
  max: number
}

export function ScoreBar({ score, max }: ScoreBarProps) {
  if (max === 0) return null
  const pct = Math.min((score / max) * 100, 100)
  const color = getScoreColor(score, max)

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div
        className="rounded-sm overflow-hidden"
        style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-sm"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[8px] font-semibold" style={{ color }}>
        {score}
      </span>
      <span className="text-[7px]" style={{ color: '#3d4f65' }}>
        /{max}
      </span>
    </div>
  )
}
