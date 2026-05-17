interface DonutSegment {
  label: string
  value: number
  color: string
}

interface Props {
  segments: DonutSegment[]
  size?: number
  centerLabel?: string
  centerValue?: string
  ariaLabel: string
}

export function DonutChart({ segments, size = 100, centerLabel, centerValue, ariaLabel }: Props) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={ariaLabel}>
          <title>{ariaLabel}</title>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--bdr-1)" strokeWidth="12" />
          {segments.map((seg) => {
            const dashLength = (seg.value / total) * circumference
            const currentOffset = offset
            offset += dashLength
            return (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={-currentOffset}
                transform="rotate(-90 50 50)"
              />
            )
          })}
        </svg>
        {centerValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-cms-text">{centerValue}</span>
            {centerLabel && <span className="text-[9px] text-cms-text-muted">{centerLabel}</span>}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: seg.color }} />
              <span className="text-cms-text-muted">{seg.label}</span>
            </span>
            <span className="font-bold tabular-nums text-cms-text">
              {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
