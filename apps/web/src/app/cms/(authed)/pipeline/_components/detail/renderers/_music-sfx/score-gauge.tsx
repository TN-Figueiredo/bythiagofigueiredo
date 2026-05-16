import { computeGaugeDasharray, computeScorePercent, getScoreColor } from './score-utils'

interface ScoreGaugeProps {
  score: number
  max: number
  size?: number
}

export function ScoreGauge({ score, max, size = 36 }: ScoreGaugeProps) {
  const pct = computeScorePercent(score, max)
  const color = getScoreColor(score, max)
  const { filled, empty } = computeGaugeDasharray(score, max)
  const r = 15
  const cx = 18
  const cy = 18

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={`Score: ${pct}%`}>
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={3}
          />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeDasharray={`${filled} ${empty}`}
            strokeDashoffset={94 / 4}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <text
            x={cx} y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill={color}
            fontSize={size <= 36 ? 10 : 12}
            fontWeight={700}
          >
            {score}
          </text>
        </svg>
      </div>
      <span className="text-[7px] leading-tight" style={{ color: '#3d4f65' }}>
        de<br />{max}
      </span>
    </div>
  )
}
