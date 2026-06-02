'use client'

import { useMemo, useState } from 'react'
import { brDec } from '@/lib/youtube/format'
import { CHART, toX, toY, niceLine, GridLines } from './chart-utils'
import type { DisplayLabel } from '@/lib/youtube/ab-types'

export interface MultiLineProps {
  series: Record<DisplayLabel, number[]>
  colors: Record<DisplayLabel, string>
  labels?: string[]
  /** Canonical prop name for the value unit displayed in tooltips */
  unit?: string
  /** @deprecated Use `unit` instead */
  suffix?: string
  /** Chart height in SVG units (default 220) */
  height?: number
}

export function MultiLine({ series, colors, labels, unit, suffix, height = 220 }: MultiLineProps) {
  const displayUnit = unit ?? suffix ?? '%'
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const { seriesKeys, length, yMin, yMax, allPts } = useMemo(() => {
    const seriesKeys = (Object.keys(series) as DisplayLabel[]).filter(
      k => series[k] && series[k].length > 0,
    )

    if (seriesKeys.length === 0) {
      return { seriesKeys: [], length: 0, yMin: 0, yMax: 1, allPts: {} as Record<DisplayLabel, Array<{ x: number; y: number }>> }
    }

    // Shortest-common-length alignment
    const length = Math.min(...seriesKeys.map(k => series[k].length))

    // Gather all values for auto-scaling
    const allValues: number[] = []
    for (const k of seriesKeys) {
      for (let i = 0; i < length; i++) {
        const v = series[k][i]
        if (v !== undefined && Number.isFinite(v)) allValues.push(v)
      }
    }

    const dataMin = Math.min(...allValues)
    const dataMax = Math.max(...allValues)
    const range = dataMax - dataMin || 1
    const yMin = dataMin - range * 0.3
    const yMax = dataMax + range * 0.3

    // Build points per series
    const cfg: import('./chart-utils').Cfg = { H: height }
    const allPts = {} as Record<DisplayLabel, Array<{ x: number; y: number }>>
    for (const k of seriesKeys) {
      allPts[k] = []
      for (let i = 0; i < length; i++) {
        const v = series[k][i]
        if (v !== undefined && Number.isFinite(v)) {
          allPts[k].push({ x: toX(i, length, cfg), y: toY(v, yMin, yMax, cfg) })
        }
      }
    }

    return { seriesKeys, length, yMin, yMax, allPts }
  }, [series, height])

  const W = CHART.W
  const H = height
  const { padL, padR } = CHART
  const cfg: import('./chart-utils').Cfg = { H: height }

  // --- empty state ---
  if (seriesKeys.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        aria-label="Multi-line chart — no data"
      >
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--cms-text-dim)"
          fontSize={13}
          fontFamily={CHART.font}
        >
          No data
        </text>
      </svg>
    )
  }

  // Compute crosshair x-label positions for vertical hover line
  const xPositions = Array.from({ length }, (_, i) => toX(i, length, cfg))

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    // Find nearest point index
    if (xPositions.length === 0) return
    let nearestIdx = 0
    let nearestDist = Infinity
    for (let i = 0; i < xPositions.length; i++) {
      const dist = Math.abs(xPositions[i]! - svgX)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = i
      }
    }
    setHoverX(xPositions[nearestIdx]!)
    setHoverIdx(nearestIdx)
  }

  function handleMouseLeave() {
    setHoverX(null)
    setHoverIdx(null)
  }

  const xLabels = labels ?? Array.from({ length }, (_, i) => `D${i + 1}`)

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        aria-label="Multi-series CTR trend chart"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'crosshair' }}
      >
        {/* Grid lines */}
        <GridLines min={yMin} max={yMax} ticks={4} cfg={cfg} />

        {/* X-axis labels */}
        <g aria-hidden="true">
          {xLabels.map((l, i) => (
            <text
              key={i}
              x={toX(i, length, cfg)}
              y={H - 4}
              textAnchor="middle"
              fill="var(--cms-text-dim)"
              fontSize={9}
              fontFamily={CHART.font}
            >
              {l}
            </text>
          ))}
        </g>

        {/* Series lines */}
        {seriesKeys.map(k => {
          const pts = allPts[k]
          if (!pts || pts.length === 0) return null
          const d = niceLine(pts)
          if (!d) return null
          return (
            <path
              key={k}
              d={d}
              fill="none"
              stroke={colors[k]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}

        {/* End dots per series */}
        {seriesKeys.map(k => {
          const pts = allPts[k]
          if (!pts || pts.length === 0) return null
          const last = pts[pts.length - 1]!
          const color = colors[k]
          return (
            <g key={`dot-${k}`}>
              <circle cx={last.x} cy={last.y} r={9} fill={color} opacity={0.4} />
              <circle cx={last.x} cy={last.y} r={5} fill={color} />
            </g>
          )
        })}

        {/* Vertical crosshair + tooltip */}
        {hoverX !== null && hoverIdx !== null && (
          <g aria-hidden="true">
            <line
              x1={hoverX}
              y1={CHART.padT}
              x2={hoverX}
              y2={H - CHART.padB}
              stroke="var(--cms-text-dim)"
              strokeWidth={1}
              strokeDasharray="4,3"
              strokeOpacity={0.6}
            />
            {seriesKeys.map(k => {
              const pts = allPts[k]
              const pt = pts?.[hoverIdx]
              if (!pt) return null
              const rawVal = series[k][hoverIdx]
              if (rawVal === undefined || !Number.isFinite(rawVal)) return null
              return (
                <text
                  key={`tip-${k}`}
                  x={hoverX + 6}
                  y={pt.y}
                  fontSize={9}
                  fill={colors[k]}
                  fontFamily={CHART.font}
                  dominantBaseline="middle"
                >
                  {k}: {brDec(rawVal, 2)}{displayUnit}
                </text>
              )
            })}
          </g>
        )}

        {/* sr-only data table for accessibility */}
        <foreignObject x={0} y={0} width={W} height={H} aria-hidden="false">
          <table className="sr-only">
            <thead>
              <tr>
                <th scope="col">Point</th>
                {seriesKeys.map(k => (
                  <th key={k} scope="col">
                    Variant {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length }, (_, i) => (
                <tr key={i}>
                  <td>{xLabels[i] ?? `D${i + 1}`}</td>
                  {seriesKeys.map(k => {
                    const v = series[k][i]
                    return <td key={k}>{v !== undefined && Number.isFinite(v) ? `${brDec(v, 2)}${displayUnit}` : '—'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </foreignObject>
      </svg>
    </>
  )
}
