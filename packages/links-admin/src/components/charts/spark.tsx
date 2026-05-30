import { useMemo } from 'react'

export interface SparkProps {
  data: number[]
  color: string
  w?: number
  h?: number
  fill?: boolean
  label?: string
}

export function Spark({ data, color, w = 90, h = 28, fill = true, label }: SparkProps) {
  if (data.length === 0) return <svg width={w} height={h} role="img" aria-label={label || 'Sparkline chart'} />

  const { d, area, last } = useMemo(() => {
    const safe = data.map(v => (Number.isFinite(v) ? v : 0))
    const max = Math.max(...safe, 1)
    const min = Math.min(...safe, 0)
    const rng = max - min || 1
    const pts = safe.map((v, i) => [
      safe.length === 1 ? w / 2 : (i / (safe.length - 1)) * w,
      h - ((v - min) / rng) * (h - 3) - 2,
    ])
    const d = pts
      .map((p, i) => (i ? 'L' : 'M') + p[0]!.toFixed(1) + ' ' + p[1]!.toFixed(1))
      .join(' ')
    const area = d + ` L${w} ${h} L0 ${h} Z`
    const last = pts[pts.length - 1]!
    return { d, area, last }
  }, [data, w, h])

  return (
    <svg width={w} height={h} role="img" aria-label={label || 'Sparkline chart'} style={{ display: 'block', overflow: 'visible' }}>
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
    </svg>
  )
}
