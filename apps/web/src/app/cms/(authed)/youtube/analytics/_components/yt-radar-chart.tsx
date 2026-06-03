interface Axis {
  label: string
  value: number
  grade: string
}

interface Props {
  axes: Axis[]
  target?: number
}

export function YtRadarChart({ axes, target = 80 }: Props) {
  const n = axes.length
  if (n < 3) return null

  const cx = 130, cy = 134, maxR = 84
  const step = (2 * Math.PI) / n

  const pt = (i: number, pct: number) => {
    const a = step * i - Math.PI / 2
    const r = (pct / 100) * maxR
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  }

  const poly = (values: number[]) =>
    values.map((v, i) => { const p = pt(i, v); return `${p.x},${p.y}` }).join(' ')

  const channelPoly = poly(axes.map(a => a.value))
  const targetPoly = poly(axes.map(() => target))

  const labelAnchor = (i: number): 'middle' | 'start' | 'end' => {
    const a = step * i - Math.PI / 2
    const x = Math.cos(a)
    if (Math.abs(x) < 0.1) return 'middle'
    return x > 0 ? 'start' : 'end'
  }

  return (
    <svg
      viewBox="-46 0 352 260"
      style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto', overflow: 'visible' }}
      role="img"
      aria-label="Radar de performance — canal vs meta"
    >
      {/* Grid rings — 4 levels */}
      {[25, 50, 75, 100].map(pct => (
        <polygon
          key={pct}
          points={poly(axes.map(() => pct))}
          fill="none"
          stroke="rgba(245,239,230,0.09)"
          strokeWidth="1"
        />
      ))}

      {/* Axis lines + labels */}
      {axes.map((a, i) => {
        const outer = pt(i, 100)
        const lbl = pt(i, 120)
        return (
          <g key={a.label}>
            <line x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="rgba(245,239,230,0.09)" />
            <text
              x={lbl.x}
              y={lbl.y}
              textAnchor={labelAnchor(i)}
              dominantBaseline="middle"
              fontSize="10.5"
              fontWeight="600"
              fill="var(--text-dim)"
              fontFamily="Inter"
            >
              {a.label}
            </text>
          </g>
        )
      })}

      {/* Canal polygon */}
      <polygon
        points={channelPoly}
        fill="var(--accent)"
        fillOpacity="0.13"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {axes.map((a, i) => {
        const p = pt(i, a.value)
        return <circle key={`c-${i}`} cx={p.x} cy={p.y} r="2.6" fill="var(--accent)" />
      })}

      {/* Meta polygon */}
      <polygon
        points={targetPoly}
        fill="var(--green)"
        fillOpacity="0.13"
        stroke="var(--green)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {axes.map((_, i) => {
        const p = pt(i, target)
        return <circle key={`m-${i}`} cx={p.x} cy={p.y} r="2.6" fill="var(--green)" />
      })}
    </svg>
  )
}
