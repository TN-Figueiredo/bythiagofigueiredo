'use client'

import { useId } from 'react'
import { niceLine } from '@/app/cms/(authed)/_shared/charts/chart-utils'

/* ─── Types ─── */

export interface RetentionMark {
  /** Fraction of video duration (0-1) */
  at: number
  label: string
  note?: string
}

interface Props {
  avgViewPercentage: number
  retentionCurve?: number[] | null
  marks?: RetentionMark[]
}

/* ─── Constants ─── */

const W = 640
const H = 220
const PAD_T = 16
const PAD_B = 28
const PAD_L = 38
const PAD_R = 14

const PLOT_W = W - PAD_L - PAD_R
const PLOT_H = H - PAD_T - PAD_B

const GRID_STROKE = 'rgba(245,239,230,0.06)'
const AXIS_FONT = 'var(--font-jetbrains, monospace)'

const Y_TICKS = [0, 25, 50, 75, 100] as const
const X_TICKS = ['0%', '25%', '50%', '75%', '100%'] as const

const DEFAULT_MARKS: RetentionMark[] = [
  { at: 0.04, label: 'Gancho', note: 'Primeiros segundos decidem se o viewer fica' },
  { at: 0.5, label: 'Meio', note: 'Ponto medio — queda acentuada indica problema de ritmo' },
]

/* ─── Helpers ─── */

function xPos(i: number, total: number): number {
  if (total <= 1) return PAD_L
  return PAD_L + (i / (total - 1)) * PLOT_W
}

function yPos(pct: number): number {
  return PAD_T + (1 - pct / 100) * PLOT_H
}

/**
 * Generate a synthetic retention curve from a single avgViewPercentage value.
 * Models typical YouTube pattern: starts at 100%, hook drop, gradual decay.
 */
function syntheticCurve(avg: number): number[] {
  const pts = 20
  const result: number[] = []
  for (let i = 0; i < pts; i++) {
    const t = i / (pts - 1)
    // Hook drop in first 5%
    const hookDrop = t < 0.05 ? (1 - t / 0.05) * 15 : 0
    // Exponential-ish decay toward end
    const decay = Math.pow(1 - t, 0.6)
    const base = avg + (100 - avg) * decay + hookDrop
    result.push(Math.min(100, Math.max(0, base)))
  }
  return result
}

/* ─── Component ─── */

export function YtRetentionCurve({ avgViewPercentage, retentionCurve, marks }: Props) {
  const uid = useId()
  const gradId = `retGrad-${uid}`
  const activeMarks = marks ?? DEFAULT_MARKS
  const data = retentionCurve && retentionCurve.length >= 2
    ? retentionCurve
    : syntheticCurve(avgViewPercentage)

  const pts = data.map((v, i) => ({ x: xPos(i, data.length), y: yPos(v) }))
  const linePath = niceLine(pts)
  const areaPath = `${linePath}L${pts[pts.length - 1]!.x},${PAD_T + PLOT_H}L${pts[0]!.x},${PAD_T + PLOT_H}Z`

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Curva de retencao — media ${avgViewPercentage.toFixed(0)}%`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.26} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <g aria-hidden="true">
          {Y_TICKS.map((tick) => {
            const y = yPos(tick)
            return (
              <g key={tick}>
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={y}
                  y2={y}
                  stroke={GRID_STROKE}
                  strokeWidth={1}
                />
                <text
                  x={PAD_L - 7}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="var(--text-faint)"
                  fontFamily={AXIS_FONT}
                >
                  {tick}%
                </text>
              </g>
            )
          })}
        </g>

        {/* Vertical marks (Gancho, Meio, etc.) */}
        <g aria-hidden="true">
          {activeMarks.map((mark) => {
            const mx = PAD_L + mark.at * PLOT_W
            return (
              <g key={mark.label}>
                <line
                  x1={mx}
                  y1={PAD_T}
                  x2={mx}
                  y2={PAD_T + PLOT_H}
                  stroke="var(--text-faint)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
                <text
                  x={mx}
                  y={PAD_T - 4}
                  textAnchor="middle"
                  fontSize={9.5}
                  fill="var(--text-dim)"
                  fontFamily={AXIS_FONT}
                >
                  {mark.label}
                </text>
              </g>
            )
          })}
        </g>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.6}
          strokeLinecap="round"
        />

        {/* X-axis labels */}
        <g aria-hidden="true">
          {X_TICKS.map((label, i) => (
            <text
              key={label}
              x={PAD_L + (i / (X_TICKS.length - 1)) * PLOT_W}
              y={H - 8}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-faint)"
              fontFamily={AXIS_FONT}
            >
              {label}
            </text>
          ))}
        </g>
      </svg>

      {/* Notes below chart */}
      {activeMarks.some((m) => m.note) && (
        <div className="ret-notes">
          {activeMarks.filter((m) => m.note).map((mark) => (
            <div key={mark.label} className="ret-note">
              <span style={{ fontWeight: 500, fontSize: 12 }}>{mark.label}</span>
              {' '}
              <span className="dim" style={{ fontSize: 12 }}>{mark.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
