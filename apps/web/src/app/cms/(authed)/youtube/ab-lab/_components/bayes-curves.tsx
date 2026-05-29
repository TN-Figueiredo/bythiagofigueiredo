'use client'

import type { StatsVariant } from '@/lib/youtube/ab-types'

export interface BayesCurvesProps {
  variants: StatsVariant[]
}

const W = 620
const H = 200
const PAD_L = 34
const PAD_R = 14
const PAD_T = 18
const PAD_B = 26
const SAMPLES = 90

function gauss(x: number, mean: number, sd: number): number {
  return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / sd) ** 2)
}

interface CurveData {
  variant: StatsVariant
  mean: number
  sd: number
  pts: Array<{ x: number; y: number }>
  peakY: number
}

export function BayesCurves({ variants }: BayesCurvesProps) {
  // Filter valid variants
  const valid = variants.filter(v => {
    if (v.impressions <= 0) return false
    const sd = Math.sqrt((v.ctr * (1 - v.ctr)) / v.impressions)
    return sd > 0
  })

  if (valid.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[var(--cms-text-dim)] text-sm">
        No valid variants
      </div>
    )
  }

  // Compute raw curve data — sample points in data space
  const curves: CurveData[] = valid.map(v => {
    const mean = v.ctr
    const sd = Math.sqrt((v.ctr * (1 - v.ctr)) / v.impressions)
    const xMin = mean - 3 * sd
    const xMax = mean + 3 * sd

    const rawPts: Array<{ x: number; y: number }> = []
    for (let i = 0; i < SAMPLES; i++) {
      const xVal = xMin + (i / (SAMPLES - 1)) * (xMax - xMin)
      const yVal = gauss(xVal, mean, sd)
      rawPts.push({ x: xVal, y: yVal })
    }

    const peakY = Math.max(...rawPts.map(p => p.y))
    return { variant: v, mean, sd, pts: rawPts, peakY }
  })

  // Global normalization — tallest curve touches top of plot area
  const globalMax = Math.max(...curves.map(c => c.peakY))

  // Compute global x range across all curves
  const allX = curves.flatMap(c => c.pts.map(p => p.x))
  const xMin = Math.min(...allX)
  const xMax = Math.max(...allX)
  const xRange = xMax - xMin || 1

  // Map data coords to SVG coords
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B

  function svgX(xVal: number): number {
    return PAD_L + ((xVal - xMin) / xRange) * plotW
  }

  function svgY(yVal: number): number {
    // y=0 at bottom, y=globalMax at top
    return PAD_T + (1 - yVal / globalMax) * plotH
  }

  // Build SVG paths per curve
  const curveElements = curves.map(c => {
    const gradId = `bayes-grad-${c.variant.label}`

    // Build fill path: curve + close to bottom
    const pts = c.pts.map(p => ({ x: svgX(p.x), y: svgY(p.y) }))
    const firstPt = pts[0]!
    const lastPt = pts[pts.length - 1]!
    const bottomY = PAD_T + plotH

    let fillD = `M${firstPt.x},${bottomY} L${firstPt.x},${firstPt.y}`
    for (let i = 1; i < pts.length; i++) {
      fillD += ` L${pts[i]!.x},${pts[i]!.y}`
    }
    fillD += ` L${lastPt.x},${bottomY} Z`

    // Stroke path (line only)
    let strokeD = `M${firstPt.x},${firstPt.y}`
    for (let i = 1; i < pts.length; i++) {
      strokeD += ` L${pts[i]!.x},${pts[i]!.y}`
    }

    // Mean line
    const meanSvgX = svgX(c.mean)

    return (
      <g key={c.variant.label}>
        {/* Fill */}
        <path
          data-curve={c.variant.label}
          d={fillD}
          fill={`url(#${gradId})`}
          stroke="none"
        />
        {/* Stroke */}
        <path
          d={strokeD}
          fill="none"
          stroke={c.variant.color}
          strokeWidth={1.5}
          opacity={0.9}
        />
        {/* Mean line */}
        <line
          data-mean={c.variant.label}
          x1={meanSvgX}
          y1={PAD_T}
          x2={meanSvgX}
          y2={PAD_T + plotH}
          stroke={c.variant.color}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.7}
        />
      </g>
    )
  })

  // Gradient defs
  const gradDefs = curves.map(c => {
    const gradId = `bayes-grad-${c.variant.label}`
    return (
      <linearGradient key={gradId} id={gradId} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={c.variant.color} stopOpacity={0.35} />
        <stop offset="100%" stopColor={c.variant.color} stopOpacity={0.03} />
      </linearGradient>
    )
  })

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        <defs>{gradDefs}</defs>
        {curveElements}
      </svg>

      {/* sr-only data table */}
      <table className="sr-only">
        <caption>Bayesian posterior distribution per variant</caption>
        <thead>
          <tr>
            <th>Variant</th>
            <th>CTR (mean)</th>
            <th>Impressions</th>
            <th>SD</th>
          </tr>
        </thead>
        <tbody>
          {valid.map(v => {
            const sd = Math.sqrt((v.ctr * (1 - v.ctr)) / v.impressions)
            return (
              <tr key={v.label}>
                <td>{v.label}</td>
                <td>{(v.ctr * 100).toFixed(2)}%</td>
                <td>{v.impressions.toLocaleString()}</td>
                <td>{(sd * 100).toFixed(3)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
