'use client'

interface ReadinessRingProps {
  score: number
  size?: number
  strokeWidth?: number
}

function getColor(score: number): string {
  if (score >= 80) return 'var(--gem-done, #22c55e)'
  if (score >= 50) return 'var(--gem-warn, #f59e0b)'
  return 'var(--gem-danger, #ef4444)'
}

export function ReadinessRing({ score, size = 48, strokeWidth = 4 }: ReadinessRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const center = size / 2

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Readiness: ${score}%`} role="img">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--gem-border, #1a2030)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
      </svg>
      <span
        className="absolute text-[11px] font-bold"
        style={{ color: getColor(score) }}
      >
        {score}%
      </span>
    </div>
  )
}
