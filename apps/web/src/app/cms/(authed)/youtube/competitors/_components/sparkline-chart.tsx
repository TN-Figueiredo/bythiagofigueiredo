'use client'

/**
 * SVG sparkline (72x26) — minimal inline chart for cards and KPI strips.
 * Uses a smoothed polyline for a clean look.
 */

interface SparklineChartProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  /** Show a filled area under the line. */
  fill?: boolean
}

function niceLine(points: Array<[number, number]>): string {
  if (points.length < 2) return ''
  const first = points[0]!
  let d = `M ${first[0]},${first[1]}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const cur = points[i]!
    const cpx = (prev[0] + cur[0]) / 2
    d += ` C ${cpx},${prev[1]} ${cpx},${cur[1]} ${cur[0]},${cur[1]}`
  }
  return d
}

export function SparklineChart({
  data,
  width = 72,
  height = 26,
  color = 'var(--accent)',
  fill = false,
}: SparklineChartProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padY = 2

  const points: Array<[number, number]> = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    padY + (1 - (v - min) / range) * (height - padY * 2),
  ])

  const linePath = niceLine(points)

  const fillPath = fill && linePath
    ? `${linePath} L ${width},${height} L 0,${height} Z`
    : undefined

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="flex-shrink-0"
      aria-hidden="true"
    >
      {fillPath && (
        <path
          d={fillPath}
          fill={color}
          opacity={0.12}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
