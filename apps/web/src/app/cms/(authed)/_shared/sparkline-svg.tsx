'use client'

/* ------------------------------------------------------------------ */
/*  Shared SparklineSvg — consolidated from blog + newsletters + dashboard */
/* ------------------------------------------------------------------ */

export interface SparklineSvgProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  variant?: 'line' | 'area'
  label?: string
}

/**
 * Lightweight sparkline SVG component.
 *
 * Supports two variants:
 * - `line` (default): stroke-only polyline
 * - `area`: stroke + translucent fill
 *
 * When `label` is provided, the SVG has `role="img"` + `aria-label` for
 * accessibility; otherwise it is `aria-hidden`.
 */
export function SparklineSvg({
  data,
  width = 64,
  height = 24,
  color = 'var(--acc)',
  variant = 'line',
  label,
}: SparklineSvgProps) {
  if (data.length < 2) return null

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

  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
      {...a11y}
    >
      {variant === 'area' && (
        <path d={areaD} fill={color} fillOpacity={0.15} />
      )}
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
