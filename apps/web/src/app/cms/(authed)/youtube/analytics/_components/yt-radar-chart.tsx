interface Axis {
  label: string
  value: number
  grade: string
}

interface Props {
  axes: Axis[]
}

const GRADE_COLORS: Record<string, string> = {
  A: '#34d399',
  B: '#60a5fa',
  C: '#fbbf24',
  D: '#f87171',
}

export function YtRadarChart({ axes }: Props) {
  const cx = 80
  const cy = 80
  const maxR = 60
  const n = axes.length
  const angleStep = (2 * Math.PI) / n

  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2
    const r = (value / 100) * maxR
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  const polygonPoints = axes
    .map((a, i) => {
      const p = getPoint(i, a.value)
      return `${p.x},${p.y}`
    })
    .join(' ')

  return (
    <svg
      viewBox="0 0 160 160"
      width={160}
      height={160}
      className="mx-auto"
      role="img"
      aria-label="Performance radar chart"
    >
      {/* Grid rings */}
      {[20, 40, 60, 80, 100].map((pct) => {
        const r = (pct / 100) * maxR
        const ringPoints = Array.from({ length: n }, (_, i) => {
          const angle = angleStep * i - Math.PI / 2
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
        }).join(' ')
        return (
          <polygon
            key={pct}
            points={ringPoints}
            fill="none"
            stroke="var(--bdr-1)"
            strokeWidth="0.5"
          />
        )
      })}

      {/* Axes lines */}
      {axes.map((_, i) => {
        const p = getPoint(i, 100)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="var(--bdr-1)"
            strokeWidth="0.5"
          />
        )
      })}

      {/* Filled polygon */}
      <polygon
        points={polygonPoints}
        fill="var(--acc)"
        fillOpacity="0.15"
        stroke="var(--acc)"
        strokeWidth="1.5"
      />

      {/* Vertex dots */}
      {axes.map((a, i) => {
        const p = getPoint(i, a.value)
        return (
          <circle
            key={a.label}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={GRADE_COLORS[a.grade] ?? '#888'}
          />
        )
      })}

      {/* Labels */}
      {axes.map((a, i) => {
        const p = getPoint(i, 120)
        return (
          <text
            key={a.label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[8px] fill-cms-text-muted"
          >
            {a.label}
          </text>
        )
      })}
    </svg>
  )
}
