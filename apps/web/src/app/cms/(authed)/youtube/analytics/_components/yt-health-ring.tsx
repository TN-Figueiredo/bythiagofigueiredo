interface Props {
  score: number
  /** Diameter in px. Default 150 (spec: 150 for Performance, 108 for AB Lab). */
  size?: number
}

export function YtHealthRing({ score, size = 150 }: Props) {
  const half = size / 2
  const strokeW = size * 0.08
  const radius = half - strokeW
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const filled = (clamped / 100) * circumference
  const color = clamped >= 65 ? '#22c55e' : clamped >= 40 ? '#fbbf24' : '#f87171'

  // Font sizes proportional to ring size
  const numSize = Math.round(size * 0.28)
  const subSize = Math.round(size * 0.06)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Saude do canal: ${clamped} de 100`}
      >
        <circle
          cx={half}
          cy={half}
          r={radius}
          fill="none"
          stroke="var(--bdr-1)"
          strokeWidth={strokeW}
        />
        <circle
          cx={half}
          cy={half}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${half} ${half})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="mono font-bold text-cms-text" style={{ fontSize: numSize }}>
          {clamped}
        </span>
        <span className="text-cms-text-muted" style={{ fontSize: subSize }}>
          / 100
        </span>
      </div>
    </div>
  )
}
