import React from 'react'

export const CHART = {
  W: 620, H: 200,
  padL: 34, padR: 14, padT: 18, padB: 26,
  font: 'JetBrains Mono, monospace',
  gridStroke: 'rgba(245,239,230,0.06)',
  axisColor: 'var(--cms-text-dim)',
  easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
} as const

export type Cfg = { W?: number; H?: number; padL?: number; padR?: number; padT?: number; padB?: number }

function resolve(c?: Cfg) {
  return {
    W: c?.W ?? CHART.W, H: c?.H ?? CHART.H,
    padL: c?.padL ?? CHART.padL, padR: c?.padR ?? CHART.padR,
    padT: c?.padT ?? CHART.padT, padB: c?.padB ?? CHART.padB,
  }
}

export function toX(i: number, total: number, cfg?: Cfg): number {
  const c = resolve(cfg)
  if (total <= 1) return c.padL
  return c.padL + (i / (total - 1)) * (c.W - c.padL - c.padR)
}

export function toY(value: number, min: number, max: number, cfg?: Cfg): number {
  const c = resolve(cfg)
  const plotH = c.H - c.padT - c.padB
  if (min === max) return c.padT + plotH / 2
  return c.padT + (1 - (value - min) / (max - min)) * plotH
}

export function niceLine(pts: Array<{ x: number; y: number }>): string {
  const clean = pts.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
  if (clean.length === 0) return ''
  if (clean.length === 1) return `M${clean[0]!.x},${clean[0]!.y}`
  if (clean.length === 2) return `M${clean[0]!.x},${clean[0]!.y}L${clean[1]!.x},${clean[1]!.y}`

  const d: string[] = [`M${clean[0]!.x},${clean[0]!.y}`]
  for (let i = 0; i < clean.length - 1; i++) {
    const p0 = clean[Math.max(i - 1, 0)]!
    const p1 = clean[i]!
    const p2 = clean[i + 1]!
    const p3 = clean[Math.min(i + 2, clean.length - 1)]!
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d.push(`C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`)
  }
  return d.join('')
}

function formatTick(val: number, range: number): string {
  if (range === 0) return String(val)
  const decimals = range < 1 ? 3 : range < 10 ? 2 : range < 100 ? 1 : 0
  return val.toFixed(decimals)
}

export interface GridLinesProps { min: number; max: number; ticks?: number; cfg?: Cfg }
export function GridLines({ min, max, ticks = 4, cfg }: GridLinesProps) {
  const c = resolve(cfg)
  const lines: React.ReactElement[] = []
  for (let i = 0; i <= ticks; i++) {
    const val = min + (i / ticks) * (max - min)
    const y = toY(val, min, max, cfg)
    lines.push(
      React.createElement('g', { key: i },
        React.createElement('line', { x1: c.padL, x2: c.W - c.padR, y1: y, y2: y, stroke: CHART.gridStroke, strokeWidth: 1 }),
        React.createElement('text', { x: c.padL - 4, y: y + 3, textAnchor: 'end', fill: CHART.axisColor, fontSize: 9, fontFamily: CHART.font }, formatTick(val, max - min)),
      ),
    )
  }
  return React.createElement('g', { 'aria-hidden': true }, ...lines)
}

export interface XLabelsProps { labels: string[]; cfg?: Cfg }
export function XLabels({ labels, cfg }: XLabelsProps) {
  const c = resolve(cfg)
  return React.createElement('g', { 'aria-hidden': true },
    ...labels.map((l, i) =>
      React.createElement('text', {
        key: i, x: toX(i, labels.length, cfg), y: c.H - 4,
        textAnchor: 'middle', fill: CHART.axisColor, fontSize: 9, fontFamily: CHART.font,
      }, l),
    ),
  )
}

export interface GradientDefProps { id: string; color: string; topOpacity?: number }
export function GradientDef({ id, color, topOpacity = 0.28 }: GradientDefProps) {
  return React.createElement('linearGradient', { id, x1: 0, x2: 0, y1: 0, y2: 1 },
    React.createElement('stop', { offset: '0%', stopColor: color, stopOpacity: topOpacity }),
    React.createElement('stop', { offset: '100%', stopColor: color, stopOpacity: 0 }),
  )
}

export interface EndDotProps { cx: number; cy: number; color: string; reached?: boolean }
export function EndDot({ cx, cy, color, reached }: EndDotProps) {
  const fill = reached ? 'var(--cms-green)' : color
  return React.createElement('g', null,
    React.createElement('circle', { cx, cy, r: 9, fill, opacity: 0.4 }),
    React.createElement('circle', { cx, cy, r: 5, fill }),
  )
}
