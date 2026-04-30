'use client'

interface SparklineSvgProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  variant?: 'line' | 'area'
}

export function SparklineSvg({ data, width = 40, height = 20, color = '#6366f1', variant = 'area' }: SparklineSvgProps) {
  if (data.length < 2) return <div style={{ width, height }} />

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)

  const points = data.map((v, i) => ({
    x: i * step,
    y: height - ((v - min) / range) * (height - 2) - 1,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      {variant === 'area' && (
        <path d={areaD} fill={color} fillOpacity={0.15} />
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
