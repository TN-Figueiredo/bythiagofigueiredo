interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  centerLabel: string
  centerValue: string | number
  size?: number
}

export function DonutChart({ segments, centerLabel, centerValue, size = 120 }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  let cumulative = 0
  const gradientStops = segments
    .map((s) => {
      const start = (cumulative / total) * 100
      cumulative += s.value
      const end = (cumulative / total) * 100
      return `${s.color} ${start}% ${end}%`
    })
    .join(', ')

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div
          className="w-full h-full rounded-full"
          style={{ background: `conic-gradient(${gradientStops})` }}
        />
        <div className="absolute inset-[25%] rounded-full bg-cms-surface flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-cms-text">{centerValue}</span>
          <span className="text-[9px] text-cms-text-dim">{centerLabel}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-cms-text-muted">{s.label}</span>
            <span className="text-cms-text font-medium ml-auto">{s.value}</span>
            <span className="text-cms-text-dim w-8 text-right">
              {total ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
