interface SparklineProps {
  points: number[]
  color?: string
  width?: number
  height?: number
  className?: string
}

export function Sparkline({ points, color = 'var(--cms-green)', width = 48, height = 28, className = '' }: SparklineProps) {
  if (points.length < 2) return null
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width
    const y = height - ((p - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })
  const lastCoord = (coords[coords.length - 1] ?? '0,0').split(',')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={lastCoord[0]} cy={lastCoord[1]} r="2" fill={color} />
    </svg>
  )
}
