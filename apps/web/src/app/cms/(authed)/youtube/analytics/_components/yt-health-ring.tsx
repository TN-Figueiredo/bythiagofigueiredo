interface Props {
  score: number
}

export function YtHealthRing({ score }: Props) {
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const filled = (clamped / 100) * circumference
  const color = clamped >= 65 ? '#34d399' : clamped >= 40 ? '#fbbf24' : '#f87171'

  return (
    <div className="relative" style={{ width: 120, height: 120 }}>
      <svg
        viewBox="0 0 120 120"
        width={120}
        height={120}
        role="img"
        aria-label={`Saúde do canal: ${clamped} de 100`}
      >
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--bdr-1)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-cms-text">{clamped}</span>
        <span className="text-[9px] text-cms-text-muted">/ 100</span>
      </div>
    </div>
  )
}
