'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'

export interface RadarChartVariant {
  label: DisplayLabel
  color: string
  ctr: number
  impressions: number
  clicks: number
  pBest: number
  pTop2: number
  linkCtr?: number
  retention?: number
}

export interface RadarChartAxis {
  key: string
  label: string
  max?: number
}

const DEFAULT_AXES: RadarChartAxis[] = [
  { key: 'ctr', label: 'CTR' },
  { key: 'retention', label: 'Retention' },
  { key: 'linkCtr', label: 'Link CTR' },
  { key: 'pBest', label: 'Win prob' },
  { key: 'impressions', label: 'Reach' },
]

export interface RadarChartProps {
  variants: RadarChartVariant[]
  axes?: RadarChartAxis[]
}

const CX = 110
const CY = 110
const RADIUS = 80
const GRID_RINGS = 4
const LABEL_OFFSET = 14
const DOT_RADIUS = 3

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  }
}

function axisAngle(index: number, total: number): number {
  // Start from top (-90 deg)
  return (index / total) * 2 * Math.PI - Math.PI / 2
}

function pointsString(points: Array<{ x: number; y: number }>): string {
  return points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

export function RadarChart({ variants, axes = DEFAULT_AXES }: RadarChartProps) {
  if (axes.length < 2) return null

  const n = axes.length

  // Compute axis max values
  const axisMaxValues = axes.map(axis => {
    if (axis.max !== undefined) return axis.max
    const vals = variants.map(v => (v as unknown as Record<string, number>)[axis.key] ?? 0)
    return Math.max(...vals, 0)
  })

  // Grid ring polygons
  const gridRingPoints = Array.from({ length: GRID_RINGS }, (_, ring) => {
    const frac = (ring + 1) / GRID_RINGS
    const pts = axes.map((_, i) => polarToCartesian(CX, CY, RADIUS * frac, axisAngle(i, n)))
    return pointsString(pts)
  })

  // Axis label positions (outside the outer ring)
  const axisLabelPos = axes.map((_, i) => {
    const angle = axisAngle(i, n)
    return polarToCartesian(CX, CY, RADIUS + LABEL_OFFSET, angle)
  })

  // Data polygons per variant
  const variantPolygons = variants.map(variant => {
    const pts = axes.map((axis, i) => {
      const rawMax = axisMaxValues[i] ?? 0
      const val = (variant as unknown as Record<string, number>)[axis.key] ?? 0
      const frac = rawMax === 0 ? 0 : Math.min(val / rawMax, 1)
      return polarToCartesian(CX, CY, RADIUS * frac, axisAngle(i, n))
    })
    return { variant, pts }
  })

  const W = CX * 2
  const H = CY * 2 + 10

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden="true"
        style={{ overflow: 'visible', width: '100%' }}
      >
        {/* Grid rings */}
        {gridRingPoints.map((pts, ring) => (
          <polygon
            key={ring}
            data-grid
            points={pts}
            fill="none"
            stroke="var(--cms-border-subtle, #2a2a2a)"
            strokeWidth={0.75}
          />
        ))}

        {/* Axis lines from center to vertex */}
        {axes.map((_, i) => {
          const outer = polarToCartesian(CX, CY, RADIUS, axisAngle(i, n))
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={outer.x.toFixed(2)}
              y2={outer.y.toFixed(2)}
              stroke="var(--cms-border-subtle, #2a2a2a)"
              strokeWidth={0.75}
            />
          )
        })}

        {/* Axis labels */}
        {axes.map((axis, i) => {
          const pos = axisLabelPos[i]!
          return (
            <text
              key={i}
              x={pos.x.toFixed(2)}
              y={pos.y.toFixed(2)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fill="var(--cms-text-dim, #888)"
              fontFamily="JetBrains Mono, monospace"
            >
              {axis.label}
            </text>
          )
        })}

        {/* Variant data polygons */}
        {variantPolygons.map(({ variant, pts }) => (
          <g key={variant.label}>
            <polygon
              data-variant
              points={pointsString(pts)}
              fill={variant.color}
              fillOpacity={0.2}
              stroke={variant.color}
              strokeWidth={1.5}
            />
            {/* Vertex dots */}
            {pts.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x.toFixed(2)}
                cy={pt.y.toFixed(2)}
                r={DOT_RADIUS}
                fill={variant.color}
              />
            ))}
          </g>
        ))}
      </svg>

      {/* sr-only data table for accessibility */}
      <table className="sr-only">
        <caption>Radar chart data per variant</caption>
        <thead>
          <tr>
            <th scope="col">Variant</th>
            {axes.map(axis => (
              <th key={axis.key} scope="col" aria-label={axis.label}>{axis.key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variants.map(variant => (
            <tr key={variant.label}>
              <td>{variant.label}</td>
              {axes.map((axis, i) => {
                const rawMax = axisMaxValues[i] ?? 0
                const val = (variant as unknown as Record<string, number>)[axis.key] ?? 0
                const pct = rawMax === 0 ? 0 : Math.min((val / rawMax) * 100, 100)
                return (
                  <td key={axis.key}>
                    {val.toLocaleString(undefined, { maximumFractionDigits: 4 })} ({pct.toFixed(0)}%)
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
