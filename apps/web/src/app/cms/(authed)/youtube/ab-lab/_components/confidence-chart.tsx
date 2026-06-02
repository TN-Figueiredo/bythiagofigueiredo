'use client'

import { useMemo } from 'react'
import { CHART, toX, toY, niceLine, GridLines, GradientDef, XLabels } from './chart-utils'

export interface ConfidenceChartProps {
  /** Confidence values 0–100, one per data point */
  data: number[]
  /** Target confidence threshold (default 95) */
  target?: number
  /** Chart height in SVG units (default 200) */
  height?: number
  /** Color override for the main line */
  accent?: string
  /** When true (test concluded), uses a solid muted style instead of gradient */
  final?: boolean
}

const DEFAULT_LINE_COLOR = 'var(--cms-accent)'
const TARGET_COLOR = 'var(--cms-green)'
const FINAL_LINE_COLOR = 'var(--cms-text-dim)'
const GRAD_ID = 'conf-chart-grad'

export function ConfidenceChart({ data, target = 95, height = 200, accent, final: isFinal = false }: ConfidenceChartProps) {
  const LINE_COLOR = accent ?? (isFinal ? FINAL_LINE_COLOR : DEFAULT_LINE_COLOR)
  const cfg: import('./chart-utils').Cfg = { H: height }
  const { clean, pts, min, max, lastVal, reached, targetY, xLabels } = useMemo(() => {
    const clean = data.filter(v => Number.isFinite(v))

    if (clean.length === 0) {
      return { clean, pts: [], min: 0, max: 100, lastVal: null, reached: false, targetY: 0, xLabels: [] }
    }

    const min = Math.min(...clean, 0)
    const max = Math.max(...clean, target, 100)
    const total = clean.length

    const pts = clean.map((v, i) => ({
      x: toX(i, total, cfg),
      y: toY(v, min, max, cfg),
    }))

    const lastVal = clean[clean.length - 1] ?? null
    const reached = lastVal !== null && lastVal >= target

    const targetY = toY(target, min, max, cfg)
    const xLabels = clean.map((_, i) => `D${i + 1}`)

    return { clean, pts, min, max, lastVal, reached, targetY, xLabels }
  }, [data, target, height])

  const W = CHART.W
  const H = height
  const { padL, padR } = CHART

  // --- empty state ---
  if (clean.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-cms-border bg-cms-bg">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-dim mb-3" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <p className="text-xs text-cms-text-muted max-w-[240px]">Aguardando impressões — a curva de confiança aparece quando o teste começar a coletar.</p>
      </div>
    )
  }

  // --- spline path ---
  const linePath = niceLine(pts)

  // --- area fill path: spline + bottom-right + bottom-left close ---
  const lastPt = pts[pts.length - 1]!
  const firstPt = pts[0]!
  const bottomY = H - (cfg.padB ?? CHART.padB)
  const areaPath = linePath && pts.length >= 2
    ? `${linePath}L${lastPt.x},${bottomY}L${firstPt.x},${bottomY}Z`
    : ''

  // --- end dot ---
  const dotCx = lastPt.x
  const dotCy = lastPt.y
  const dotColor = reached ? TARGET_COLOR : LINE_COLOR

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block' }}
        aria-label="Confidence trend chart"
      >
        <defs>
          <GradientDef id={GRAD_ID} color={LINE_COLOR} topOpacity={isFinal ? 0.1 : 0.25} />
        </defs>

        {/* Grid lines */}
        <GridLines min={min} max={max} ticks={4} cfg={cfg} />

        {/* X-axis labels */}
        <XLabels labels={xLabels} cfg={cfg} />

        {/* Gradient area fill */}
        {areaPath && (
          <path
            d={areaPath}
            fill={`url(#${GRAD_ID})`}
            stroke="none"
          />
        )}

        {/* Spline line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Target dashed line */}
        <line
          x1={padL}
          y1={targetY}
          x2={W - padR}
          y2={targetY}
          stroke={TARGET_COLOR}
          strokeWidth={1.5}
          strokeDasharray="6,3"
          strokeOpacity={0.85}
        />
        <text
          x={W - padR - 2}
          y={targetY - 6}
          textAnchor="end"
          fontSize={9.5}
          fontWeight={600}
          fill={TARGET_COLOR}
          fontFamily={CHART.font}
        >
          META {target}%
        </text>

        {/* End dot — outer halo */}
        <circle cx={dotCx} cy={dotCy} r={9} fill={dotColor} opacity={0.4} />
        {/* End dot — inner solid */}
        <circle cx={dotCx} cy={dotCy} r={5} fill={dotColor} />

        {/* Current value label above the dot */}
        {lastVal !== null && (
          <text
            x={dotCx}
            y={dotCy - 13}
            textAnchor="middle"
            fontSize={10}
            fontWeight="bold"
            fill={dotColor}
            fontFamily={CHART.font}
          >
            {lastVal.toFixed(1)}%
          </text>
        )}

        {/* sr-only data table for accessibility */}
        <foreignObject x={0} y={0} width={W} height={H} aria-hidden="false">
          <table className="sr-only">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {clean.map((v, i) => (
                <tr key={i}>
                  <td>D{i + 1}</td>
                  <td>{v.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </foreignObject>
      </svg>
    </>
  )
}
