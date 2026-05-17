interface Props {
  avgPercentage: number
}

export function YtRetentionCurve({ avgPercentage }: Props) {
  const w = 400
  const h = 80
  const hookDrop = Math.max(100 - 30, avgPercentage + 10)
  const midPoint = avgPercentage
  const endPoint = Math.max(avgPercentage - 10, 10)

  const points = [
    { x: 0, y: 100 },
    { x: 30, y: hookDrop },
    { x: 100, y: midPoint + 5 },
    { x: 200, y: midPoint },
    { x: 300, y: midPoint - 5 },
    { x: w, y: endPoint },
  ]

  const toSvgY = (pct: number) => h - (pct / 100) * h
  const path = `M ${points.map((p) => `${p.x},${toSvgY(p.y)}`).join(' L ')}`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      style={{ height: '80px' }}
      role="img"
      aria-label="Average retention curve"
    >
      <defs>
        <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--acc)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--acc)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w},${h} L 0,${h} Z`} fill="url(#retGrad)" />
      <path d={path} fill="none" stroke="var(--acc)" strokeWidth="2" />
      {/* 70% mark */}
      <line
        x1="0"
        y1={toSvgY(70)}
        x2={w}
        y2={toSvgY(70)}
        stroke="var(--t5)"
        strokeWidth="0.5"
        strokeDasharray="3"
      />
      <text
        x={w - 5}
        y={toSvgY(70) - 3}
        textAnchor="end"
        className="text-[8px] fill-cms-text-muted"
      >
        70%
      </text>
    </svg>
  )
}
