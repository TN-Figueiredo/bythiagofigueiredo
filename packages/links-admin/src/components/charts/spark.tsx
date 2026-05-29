export interface SparkProps {
  data: number[]
  color: string
  w?: number
  h?: number
  fill?: boolean
}

export function Spark({ data, color, w = 90, h = 28, fill = true }: SparkProps) {
  if (data.length === 0) return <svg width={w} height={h} />

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const rng = max - min || 1
  const pts = data.map((v, i) => [
    data.length === 1 ? w / 2 : (i / (data.length - 1)) * w,
    h - ((v - min) / rng) * (h - 3) - 2,
  ])
  const d = pts
    .map((p, i) => (i ? 'L' : 'M') + p[0]!.toFixed(1) + ' ' + p[1]!.toFixed(1))
    .join(' ')
  const area = d + ` L${w} ${h} L0 ${h} Z`
  const last = pts[pts.length - 1]!

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
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
