/**
 * PSparkline — consolidated sparkline component.
 * Props: data (number[]), width (72), height (26), color, smooth (uses niceLine).
 * SVG with optional area fill.
 */

import { niceLine } from '@/app/cms/(authed)/_shared/charts/chart-utils'

interface PSparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  smooth?: boolean
  /** Show area fill below the line */
  area?: boolean
}

export function PSparkline({
  data,
  width = 72,
  height = 26,
  color = 'var(--accent)',
  smooth = true,
  area = true,
}: PSparklineProps) {
  if (data.length < 2) return null

  const pad = 1
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }))

  const linePath = smooth ? niceLine(pts) : `M${pts.map(p => `${p.x},${p.y}`).join('L')}`

  const areaPath = area
    ? `${linePath}L${pts[pts.length - 1]!.x},${height}L${pts[0]!.x},${height}Z`
    : undefined

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0"
    >
      {areaPath && (
        <path d={areaPath} fill={color} opacity={0.15} />
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
