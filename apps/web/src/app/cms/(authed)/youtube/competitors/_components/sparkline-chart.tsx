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
  /** Band showing subscriber rounding uncertainty (upper/lower bounds). */
  band?: { upper: number[]; lower: number[] }
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
  band,
}: SparklineChartProps) {
  if (data.length < 2) return null

  // Expand min/max to include band values for consistent scaling
  const allValues = [
    ...data,
    ...(band ? band.upper : []),
    ...(band ? band.lower : []),
  ]
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = max - min || 1
  const padY = 2

  const toPoint = (v: number, i: number, len: number): [number, number] => [
    (i / (len - 1)) * width,
    padY + (1 - (v - min) / range) * (height - padY * 2),
  ]

  const points: Array<[number, number]> = data.map((v, i) => toPoint(v, i, data.length))

  const linePath = niceLine(points)

  const fillPath = fill && linePath
    ? `${linePath} L ${width},${height} L 0,${height} Z`
    : undefined

  // Build closed band path: upper L→R, then lower R→L
  let bandPath: string | undefined
  if (band && band.upper.length >= 2 && band.lower.length >= 2) {
    const upperPoints: Array<[number, number]> = band.upper.map((v, i) =>
      toPoint(v, i, band.upper.length),
    )
    const lowerPoints: Array<[number, number]> = band.lower.map((v, i) =>
      toPoint(v, i, band.lower.length),
    )
    const upperPath = niceLine(upperPoints)
    // Lower traversed right-to-left to close the shape
    const lowerReversed = [...lowerPoints].reverse()
    const lowerPath = niceLine(lowerReversed)
    if (upperPath && lowerPath) {
      const lowerStart = lowerReversed[0]!
      bandPath = `${upperPath} L ${lowerStart[0]},${lowerStart[1]} ${lowerPath.slice(1)} Z`
    }
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="flex-shrink-0"
      aria-hidden="true"
    >
      {bandPath && (
        <path
          d={bandPath}
          fill={color}
          stroke="none"
          opacity={0.08}
        />
      )}
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
