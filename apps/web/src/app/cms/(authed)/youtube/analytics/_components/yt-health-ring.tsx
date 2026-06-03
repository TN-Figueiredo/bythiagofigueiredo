interface Props {
  score: number
  /** Diameter in px. Default 150 (spec: 150 for Performance, 108 for AB Lab). */
  size?: number
  /** Target score shown as a tick mark on the ring. Default 80. */
  target?: number
}

export function YtHealthRing({ score, size = 150, target = 80 }: Props) {
  const half = size / 2
  const strokeW = Math.round(size * 0.053)
  const radius = half - strokeW - 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const filled = (clamped / 100) * circumference

  const tickAngle = (target / 100) * 360
  const tickInner = half + radius - strokeW / 2 - 2
  const tickOuter = half + radius + strokeW / 2 + 2

  const numSize = Math.round(size * 0.28)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
        role="img"
        aria-label={`Saude do canal: ${clamped} de 100`}
      >
        <circle
          cx={half}
          cy={half}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={strokeW}
        />
        <circle
          cx={half}
          cy={half}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.2, 0.7, 0.2, 1)' }}
        />
        <line
          x1={tickInner}
          y1={half}
          x2={tickOuter}
          y2={half}
          stroke="var(--green)"
          strokeWidth="2"
          transform={`rotate(${tickAngle} ${half} ${half})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="mono font-bold text-cms-text" style={{ fontSize: numSize }}>
          {clamped}
        </span>
      </div>
    </div>
  )
}
