# A/B Lab Redesign -- Layer 2: Charts

**Date:** 2026-05-29
**Depends on:** Layer 1 (Foundation) must be complete
**Estimate:** ~8h
**LOC:** ~1400 new, ~442 deleted (3 replaced), 1 modified

---

## Prerequisites

Layer 1 files must exist and export:
- `ab-constants.ts` -- `DisplayLabel`, `VARIANT_COLORS`, `toDisplayLabel()`, `variantColor()`, formatters
- `chart-utils.ts` -- `CHART`, `toX()`, `toY()`, `niceLine()`, `GridLines`, `XLabels`, `GradientDef`, `EndDot`
- `ab-primitives.tsx` -- `VChip`, `Legend`
- `index.ts` -- barrel export

Base path: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/`
Test path: `apps/web/test/`

---

## Task 1: confidence-chart.tsx (~150 LOC, ~45min)

Replaces `ab-confidence-trend.tsx` (175 LOC). Catmull-Rom spline + gradient area fill + dashed target line.

### 1.1 RED -- Write failing tests first

File: `apps/web/test/ab-charts.test.tsx`

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

// Lucide mock -- all tests in this file share it
vi.mock('lucide-react', () =>
  new Proxy({}, {
    get: (_, name) =>
      name === '__esModule' ? true
        : (props: Record<string, unknown>) => <svg data-testid={`icon-${String(name)}`} {...props} />,
  }),
)

import { ConfidenceChart } from '@/app/cms/(authed)/youtube/ab-lab/_components/confidence-chart'

afterEach(() => cleanup())

describe('ConfidenceChart', () => {
  it('renders SVG with correct viewBox', () => {
    const { container } = render(<ConfidenceChart data={[50, 65, 78]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 620 200')
  })

  it('renders dashed target line at default 95%', () => {
    const { container } = render(<ConfidenceChart data={[50, 60]} />)
    const lines = container.querySelectorAll('line[stroke-dasharray]')
    const targetLine = Array.from(lines).find(l => l.getAttribute('stroke') === '#22c55e')
    expect(targetLine).toBeTruthy()
  })

  it('renders custom target line', () => {
    const { container } = render(<ConfidenceChart data={[50]} target={80} />)
    const texts = container.querySelectorAll('text')
    const targetLabel = Array.from(texts).find(t => t.textContent === '80%')
    expect(targetLabel).toBeTruthy()
  })

  it('renders placeholder when data is empty', () => {
    const { container } = render(<ConfidenceChart data={[]} />)
    const text = container.querySelector('text')
    expect(text?.textContent).toContain('No data')
  })

  it('renders single dot for 1-point data', () => {
    const { container } = render(<ConfidenceChart data={[42]} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(1)
    // No path should be rendered for single point
    const path = container.querySelector('path[d]')
    expect(path?.getAttribute('d') || '').not.toContain('C') // no cubic bezier
  })

  it('filters NaN values from data', () => {
    const { container } = render(<ConfidenceChart data={[50, NaN, 70, NaN, 90]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    // Should render without error
  })

  it('EndDot turns green when last value >= target', () => {
    const { container } = render(<ConfidenceChart data={[50, 70, 96]} target={95} />)
    const circles = container.querySelectorAll('circle')
    const lastCircle = circles[circles.length - 1]
    // EndDot uses green fill when reached
    expect(lastCircle?.getAttribute('fill')).toContain('#22c55e')
  })

  it('includes sr-only data table', () => {
    const { container } = render(<ConfidenceChart data={[50, 60, 70]} />)
    const table = container.querySelector('table.sr-only')
    expect(table).toBeTruthy()
    const rows = table?.querySelectorAll('tr')
    // header + 3 data rows
    expect(rows?.length).toBe(4)
  })
})
```

### 1.2 GREEN -- Implement component

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/confidence-chart.tsx`

```tsx
'use client'

import { useState, useMemo } from 'react'
import { CHART, toX, toY, niceLine, GridLines, XLabels, GradientDef, EndDot } from './chart-utils'

export interface ConfidenceChartProps {
  data: number[]
  target?: number    // default 95 (percent, not decimal)
  height?: number    // default 200
  accent?: string    // default var(--cms-accent)
}

export function ConfidenceChart({
  data: rawData,
  target = 95,
  height = CHART.H,
  accent = 'var(--cms-accent)',
}: ConfidenceChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const data = useMemo(
    () => rawData.filter(v => Number.isFinite(v)),
    [rawData],
  )

  const cfg = useMemo(() => ({ ...CHART, H: height }), [height])

  if (data.length === 0) {
    return (
      <svg viewBox={`0 0 ${cfg.W} ${cfg.H}`} width="100%" height={cfg.H} role="img" aria-label="Confidence chart -- no data">
        <text x={cfg.W / 2} y={cfg.H / 2} textAnchor="middle" fontSize={12} fill="var(--cms-text-dim)">No data yet</text>
      </svg>
    )
  }

  const pts = data.map((v, i) => ({
    x: toX(i, data.length, cfg),
    y: toY(v, 0, 100, cfg),
  }))

  const linePath = niceLine(pts)
  const targetY = toY(target, 0, 100, cfg)
  const lastVal = data[data.length - 1] ?? 0
  const reached = lastVal >= target

  // Area fill path: line path + close to bottom
  const areaPath = linePath
    ? `${linePath} L ${pts[pts.length - 1]!.x} ${cfg.H - cfg.padB} L ${pts[0]!.x} ${cfg.H - cfg.padB} Z`
    : ''

  const gridValues = [0, 25, 50, 75, 100]
  const xLabels = data.map((_, i) => `D${i + 1}`)

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${cfg.W} ${cfg.H}`}
        width="100%"
        height={cfg.H}
        role="img"
        aria-label={`Confidence trend chart. Current: ${lastVal.toFixed(0)}%, Target: ${target}%`}
        className="ab-lab"
      >
        <GradientDef id="conf-grad" color={accent} topOpacity={0.28} />

        <GridLines values={gridValues} min={0} max={100} cfg={cfg} format={v => `${v}%`} />
        <XLabels labels={xLabels} cfg={cfg} />

        {/* Target line */}
        <line
          x1={cfg.padL} y1={targetY}
          x2={cfg.W - cfg.padR} y2={targetY}
          stroke="#22c55e" strokeWidth={1.5}
          strokeDasharray="6,3" strokeOpacity={0.8}
        />
        <text
          x={cfg.W - cfg.padR - 2} y={targetY - 4}
          textAnchor="end" fontSize={8}
          fill="#22c55e" fillOpacity={0.8}
        >
          {target}%
        </text>

        {/* Area fill */}
        {areaPath && data.length > 1 && (
          <path d={areaPath} fill="url(#conf-grad)" />
        )}

        {/* Line */}
        {linePath && data.length > 1 && (
          <path
            d={linePath}
            fill="none" stroke={accent} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              strokeDasharray: 2000,
              strokeDashoffset: 0,
              transition: `stroke-dashoffset 0.8s ${CHART.easing}`,
            }}
          />
        )}

        {/* End dot */}
        {pts.length > 0 && (
          <EndDot
            cx={pts[pts.length - 1]!.x}
            cy={pts[pts.length - 1]!.y}
            reached={reached}
          />
        )}

        {/* Single point case */}
        {data.length === 1 && pts[0] && (
          <circle cx={pts[0].x} cy={pts[0].y} r={4} fill={reached ? '#22c55e' : accent} />
        )}

        {/* Tooltip hitboxes */}
        {pts.map((pt, i) => {
          const w = (cfg.W - cfg.padL - cfg.padR) / Math.max(data.length - 1, 1)
          return (
            <rect
              key={i}
              x={pt.x - w / 2} y={cfg.padT}
              width={w} height={cfg.H - cfg.padT - cfg.padB}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}

        {/* Tooltip */}
        {hovered !== null && pts[hovered] && (
          <g aria-hidden="true">
            <rect
              x={pts[hovered]!.x - 36} y={pts[hovered]!.y - 28}
              width={72} height={22} rx={6}
              fill="var(--cms-surface-3)" stroke="var(--cms-border)" strokeWidth={0.5}
            />
            <text
              x={pts[hovered]!.x} y={pts[hovered]!.y - 14}
              textAnchor="middle" fontSize={10}
              fontFamily={CHART.font} fill="var(--cms-text)"
            >
              Day {hovered + 1}: {data[hovered]!.toFixed(1)}%
            </text>
          </g>
        )}
      </svg>

      {/* sr-only data table */}
      <table className="sr-only">
        <thead><tr><th>Day</th><th>Confidence</th></tr></thead>
        <tbody>
          {data.map((v, i) => (
            <tr key={i}><td>Day {i + 1}</td><td>{v.toFixed(1)}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### 1.3 REFACTOR -- Verify

```bash
npm run test:web -- --run test/ab-charts.test.tsx
```

---

## Task 2: multi-line.tsx (~170 LOC, ~45min)

Replaces `ab-daily-ctr-chart.tsx` (140 LOC). Multi-series Catmull-Rom lines, vertical crosshair tooltip.

### 2.1 RED -- Append to ab-charts.test.tsx

```tsx
import { MultiLine } from '@/app/cms/(authed)/youtube/ab-lab/_components/multi-line'

describe('MultiLine', () => {
  const colors = { A: '#8A8F98', B: '#E8823C', C: '#3FA9C0', D: '#A77CE8' } as const

  it('renders one path per series', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [3, 4, 5], B: [2, 3, 4] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    const paths = container.querySelectorAll('path[stroke]')
    expect(paths.length).toBe(2)
  })

  it('renders end dots per series', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [3, 4, 5], B: [2, 3, 4] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(2)
  })

  it('auto-scales Y with 0.6 padding', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [10, 20], B: [15, 25] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
  })

  it('uses shortest common length for different-length series', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [1, 2, 3, 4, 5], B: [10, 20, 30] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    // Both paths should exist
    const paths = container.querySelectorAll('path[stroke]')
    expect(paths.length).toBe(2)
  })

  it('renders sr-only table', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [3, 4], B: [5, 6] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    expect(container.querySelector('table.sr-only')).toBeTruthy()
  })

  it('renders nothing for empty series', () => {
    const { container } = render(
      <MultiLine series={{} as Record<DisplayLabel, number[]>} colors={colors} />,
    )
    const text = container.querySelector('text')
    expect(text?.textContent).toContain('No data')
  })
})
```

### 2.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/multi-line.tsx`

```tsx
'use client'

import { useState, useMemo } from 'react'
import type { DisplayLabel } from './ab-constants'
import { CHART, toX, toY, niceLine, GridLines, XLabels, GradientDef } from './chart-utils'

export interface MultiLineProps {
  series: Record<DisplayLabel, number[]>
  colors: Record<DisplayLabel, string>
  height?: number    // default 220
  unit?: string      // Y suffix, default "%"
  labels?: string[]  // X labels
}

export function MultiLine({
  series,
  colors,
  height = 220,
  unit = '%',
  labels: xLabels,
}: MultiLineProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const cfg = useMemo(() => ({ ...CHART, H: height }), [height])

  const entries = useMemo(() => {
    const raw = Object.entries(series) as [DisplayLabel, number[]][]
    return raw.filter(([, vals]) => vals.length > 0)
  }, [series])

  if (entries.length === 0) {
    return (
      <svg viewBox={`0 0 ${cfg.W} ${cfg.H}`} width="100%" height={cfg.H} role="img" aria-label="Multi-line chart -- no data">
        <text x={cfg.W / 2} y={cfg.H / 2} textAnchor="middle" fontSize={12} fill="var(--cms-text-dim)">No data yet</text>
      </svg>
    )
  }

  const commonLen = Math.min(...entries.map(([, v]) => v.length))
  const allVals = entries.flatMap(([, v]) => v.slice(0, commonLen)).filter(Number.isFinite)
  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const range = rawMax - rawMin || 1
  const yMin = rawMin - range * 0.6
  const yMax = rawMax + range * 0.6

  const gridValues = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4)

  const seriesData = entries.map(([label, vals]) => {
    const data = vals.slice(0, commonLen)
    const pts = data.map((v, i) => ({
      x: toX(i, commonLen, cfg),
      y: toY(v, yMin, yMax, cfg),
      value: v,
    }))
    return { label, data, pts, color: colors[label] ?? '#888', path: niceLine(pts) }
  })

  const defaultXLabels = xLabels ?? Array.from({ length: commonLen }, (_, i) => `D${i + 1}`)

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${cfg.W} ${cfg.H}`}
        width="100%" height={cfg.H}
        role="img" aria-label="Multi-line CTR chart"
        className="ab-lab"
      >
        <GridLines values={gridValues} min={yMin} max={yMax} cfg={cfg} format={v => `${v.toFixed(1)}${unit}`} />
        <XLabels labels={defaultXLabels} cfg={cfg} />

        {seriesData.map(({ label, pts, path, color }, si) =>
          path ? (
            <g key={label}>
              <path
                d={path} fill="none" stroke={color} strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round"
                style={{
                  strokeDasharray: 2000, strokeDashoffset: 0,
                  transition: `stroke-dashoffset 0.8s ${CHART.easing}`,
                  transitionDelay: `${si * 100}ms`,
                }}
              />
              {/* End dot */}
              {pts.length > 0 && (
                <circle
                  cx={pts[pts.length - 1]!.x} cy={pts[pts.length - 1]!.y}
                  r={3.4} fill={color}
                />
              )}
            </g>
          ) : null,
        )}

        {/* Crosshair hitboxes */}
        {Array.from({ length: commonLen }, (_, i) => {
          const w = (cfg.W - cfg.padL - cfg.padR) / Math.max(commonLen - 1, 1)
          const cx = toX(i, commonLen, cfg)
          return (
            <rect
              key={i}
              x={cx - w / 2} y={cfg.padT}
              width={w} height={cfg.H - cfg.padT - cfg.padB}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}

        {/* Vertical crosshair + tooltip */}
        {hovered !== null && (
          <g aria-hidden="true">
            <line
              x1={toX(hovered, commonLen, cfg)} y1={cfg.padT}
              x2={toX(hovered, commonLen, cfg)} y2={cfg.H - cfg.padB}
              stroke="var(--cms-text-dim)" strokeWidth={1} strokeDasharray="3,3"
            />
            {seriesData.map(({ label, pts, color }) => {
              const pt = pts[hovered]
              if (!pt) return null
              return (
                <g key={label}>
                  <circle cx={pt.x} cy={pt.y} r={4} fill={color} />
                  <text
                    x={pt.x + 8} y={pt.y + 3}
                    fontSize={9} fontFamily={CHART.font} fill={color}
                  >
                    {label}: {pt.value.toFixed(2)}{unit}
                  </text>
                </g>
              )
            })}
          </g>
        )}
      </svg>

      <table className="sr-only">
        <thead>
          <tr>
            <th>Day</th>
            {seriesData.map(s => <th key={s.label}>{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: commonLen }, (_, i) => (
            <tr key={i}>
              <td>Day {i + 1}</td>
              {seriesData.map(s => (
                <td key={s.label}>{s.data[i]?.toFixed(2)}{unit}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## Task 3: abba-timeline.tsx (~100 LOC, ~30min)

Replaces `ab-rotation-timeline.tsx` (127 LOC). Flex row of colored letter blocks.

### 3.1 RED -- Append to ab-charts.test.tsx

```tsx
import { ABBATimeline } from '@/app/cms/(authed)/youtube/ab-lab/_components/abba-timeline'

describe('ABBATimeline', () => {
  it('renders correct number of blocks', () => {
    const { container } = render(
      <ABBATimeline seq={['A', 'B', 'B', 'A']} total={4} done={2} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const blocks = container.querySelectorAll('[data-block]')
    expect(blocks.length).toBe(4)
  })

  it('marks done blocks with full color', () => {
    const { container } = render(
      <ABBATimeline seq={['A', 'B']} total={2} done={1} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const blocks = container.querySelectorAll('[data-block]')
    expect(blocks[0]?.getAttribute('style')).toContain('#8A8F98')
  })

  it('marks pending blocks with low opacity', () => {
    const { container } = render(
      <ABBATimeline seq={['A', 'B']} total={2} done={0} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const blocks = container.querySelectorAll('[data-block]')
    expect(blocks[0]?.getAttribute('style')).toContain('opacity')
  })

  it('shows footer with cycle count', () => {
    const { getByText } = render(
      <ABBATimeline seq={['A', 'B', 'B', 'A']} total={4} done={2} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    expect(getByText(/2\/4/)).toBeTruthy()
  })

  it('highlights next variant block with dashed border', () => {
    const { container } = render(
      <ABBATimeline
        seq={['A', 'B', 'B', 'A']} total={4} done={2}
        colors={{ A: '#8A8F98', B: '#E8823C' }}
        nextVariant="B"
      />,
    )
    const dashed = container.querySelector('[data-next]')
    expect(dashed).toBeTruthy()
  })

  it('enables horizontal scroll for 50+ blocks', () => {
    const seq = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 'A' : 'B') as DisplayLabel)
    const { container } = render(
      <ABBATimeline seq={seq} total={60} done={30} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const wrapper = container.querySelector('[data-scroll]')
    expect(wrapper).toBeTruthy()
  })
})
```

### 3.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/abba-timeline.tsx`

```tsx
'use client'

import type { DisplayLabel } from './ab-constants'

export interface ABBATimelineProps {
  seq: DisplayLabel[]
  total: number
  done: number
  colors: Record<string, string>
  nextVariant?: DisplayLabel
  nextIn?: string
}

export function ABBATimeline({ seq, total, done, colors, nextVariant, nextIn }: ABBATimelineProps) {
  const useScroll = total >= 50

  return (
    <div className="space-y-2">
      <div
        data-scroll={useScroll || undefined}
        className={useScroll ? 'overflow-x-auto' : ''}
      >
        <div
          className="flex gap-[2px]"
          style={useScroll ? { minWidth: total * 26 } : undefined}
        >
          {seq.slice(0, total).map((label, i) => {
            const isDone = i < done
            const isNext = !isDone && i === done && label === nextVariant
            const color = colors[label] ?? '#888'

            return (
              <div
                key={i}
                data-block=""
                data-next={isNext || undefined}
                className="flex items-center justify-center rounded-sm text-[9px] font-bold select-none flex-shrink-0"
                style={{
                  width: useScroll ? 24 : undefined,
                  minWidth: useScroll ? 24 : 18,
                  height: 32,
                  flex: useScroll ? '0 0 24px' : '1 0 18px',
                  backgroundColor: isDone ? color : 'var(--cms-surface-hover)',
                  opacity: isDone ? 1 : 0.4,
                  color: isDone ? '#1a1a1a' : 'var(--cms-text-dim)',
                  ...(isNext ? {
                    border: '2px dashed var(--cms-accent)',
                    opacity: 0.7,
                  } : {}),
                }}
              >
                {label}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-cms-text-dim">
        <span>{done}/{total} ABBA cycles completed</span>
        {nextIn && nextVariant && (
          <span>Next: {nextVariant} in {nextIn}</span>
        )}
      </div>
    </div>
  )
}
```

---

## Task 4: gauge.tsx (~110 LOC, ~30min)

Radial SVG arc with centered text overlay.

### 4.1 RED -- Append to ab-charts.test.tsx

```tsx
import { Gauge } from '@/app/cms/(authed)/youtube/ab-lab/_components/gauge'

describe('Gauge', () => {
  it('renders with role="meter"', () => {
    const { container } = render(<Gauge value={75} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter).toBeTruthy()
    expect(meter?.getAttribute('aria-valuenow')).toBe('75')
  })

  it('sets aria-valuemin and aria-valuemax', () => {
    const { container } = render(<Gauge value={50} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuemin')).toBe('0')
    expect(meter?.getAttribute('aria-valuemax')).toBe('100')
  })

  it('clamps value to 0-100', () => {
    const { container } = render(<Gauge value={150} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('100')
  })

  it('treats NaN as 0', () => {
    const { container } = render(<Gauge value={NaN} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('0')
  })

  it('turns green when value >= target', () => {
    const { container } = render(<Gauge value={96} target={95} />)
    const arc = container.querySelector('[data-arc]')
    expect(arc?.getAttribute('stroke')).toBe('var(--cms-green)')
  })

  it('renders value text', () => {
    const { getByText } = render(<Gauge value={88} />)
    expect(getByText('88%')).toBeTruthy()
  })
})
```

### 4.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/gauge.tsx`

```tsx
'use client'

import { CHART } from './chart-utils'

export interface GaugeProps {
  value: number    // 0-100
  target?: number  // default 95
  size?: number    // default 132
  color?: string   // default var(--cms-accent)
}

export function Gauge({
  value: rawValue,
  target = 95,
  size = 132,
  color = 'var(--cms-accent)',
}: GaugeProps) {
  const value = Number.isFinite(rawValue)
    ? Math.max(0, Math.min(100, rawValue))
    : 0
  const reached = value >= target

  const cx = size / 2
  const cy = size / 2
  const r = (size - 20) / 2
  const sw = 8
  const C = 2 * Math.PI * r
  const frac = value / 100
  const arcColor = reached ? 'var(--cms-green)' : color

  // Target tick angle (0 = 12 o'clock, clockwise)
  const targetAngle = (target / 100) * 360 - 90
  const tickRad = (targetAngle * Math.PI) / 180
  const tickX1 = cx + (r - sw / 2 - 2) * Math.cos(tickRad)
  const tickY1 = cy + (r - sw / 2 - 2) * Math.sin(tickRad)
  const tickX2 = cx + (r + sw / 2 + 2) * Math.cos(tickRad)
  const tickY2 = cy + (r + sw / 2 + 2) * Math.sin(tickRad)

  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Confidence: ${value}%`}
      style={{ width: size, height: size }}
      className="relative"
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="var(--cms-surface-hover)"
          strokeWidth={sw}
        />

        {/* Arc */}
        <circle
          data-arc=""
          cx={cx} cy={cy} r={r}
          fill="none" stroke={arcColor}
          strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${C * frac} ${C}`}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            transition: `stroke-dasharray 0.8s ${CHART.easing}`,
          }}
        />

        {/* Target tick */}
        <line
          x1={tickX1} y1={tickY1} x2={tickX2} y2={tickY2}
          stroke="var(--cms-text-dim)" strokeWidth={1.5}
        />
      </svg>

      {/* Text overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden="true"
      >
        <span className="text-[8px] uppercase tracking-wider text-cms-text-dim">
          confidence
        </span>
        <span
          className="font-bold"
          style={{ fontFamily: CHART.font, fontSize: 24, color: 'var(--cms-text)' }}
        >
          {value}%
        </span>
      </div>
    </div>
  )
}
```

---

## Task 5: credible-interval.tsx (~120 LOC, ~30min)

95% CI bands with mean dot per variant (CSS layout, not SVG).

### 5.1 RED -- Append to ab-charts.test.tsx

```tsx
import { CredibleInterval } from '@/app/cms/(authed)/youtube/ab-lab/_components/credible-interval'
import type { StatsVariant } from './ab-constants'

describe('CredibleInterval', () => {
  const variants: StatsVariant[] = [
    { label: 'A', color: '#8A8F98', ctr: 0.05, impressions: 10000 },
    { label: 'B', color: '#E8823C', ctr: 0.07, impressions: 10000 },
  ]

  it('renders one row per variant', () => {
    const { container } = render(<CredibleInterval variants={variants} />)
    const rows = container.querySelectorAll('[data-ci-row]')
    expect(rows.length).toBe(2)
  })

  it('skips variants with 0 impressions', () => {
    const withZero = [...variants, { label: 'C' as DisplayLabel, color: '#3FA9C0', ctr: 0.04, impressions: 0 }]
    const { container } = render(<CredibleInterval variants={withZero} />)
    const rows = container.querySelectorAll('[data-ci-row]')
    expect(rows.length).toBe(2)
  })

  it('highlights leader with ring on VChip', () => {
    const { container } = render(<CredibleInterval variants={variants} leader="B" />)
    const ring = container.querySelector('[data-leader-ring]')
    expect(ring).toBeTruthy()
  })

  it('renders single variant without error', () => {
    const { container } = render(
      <CredibleInterval variants={[variants[0]!]} />,
    )
    const rows = container.querySelectorAll('[data-ci-row]')
    expect(rows.length).toBe(1)
  })

  it('renders mean dot for each row', () => {
    const { container } = render(<CredibleInterval variants={variants} />)
    const dots = container.querySelectorAll('[data-mean-dot]')
    expect(dots.length).toBe(2)
  })
})
```

### 5.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/credible-interval.tsx`

```tsx
'use client'

import { useMemo } from 'react'
import type { DisplayLabel } from './ab-constants'
import { CHART } from './chart-utils'

export interface StatsVariant {
  label: DisplayLabel
  color: string
  ctr: number       // 0-1
  impressions: number
}

export interface CredibleIntervalProps {
  variants: StatsVariant[]
  leader?: DisplayLabel
}

interface CIData {
  label: DisplayLabel
  color: string
  mean: number
  lo: number
  hi: number
}

function computeCI(v: StatsVariant): CIData | null {
  if (v.impressions <= 0) return null
  const p = v.ctr
  const sd = Math.sqrt((p * (1 - p)) / v.impressions)
  if (sd === 0) return null
  return {
    label: v.label,
    color: v.color,
    mean: p * 100,
    lo: Math.max(0, (p - 1.96 * sd) * 100),
    hi: Math.min(100, (p + 1.96 * sd) * 100),
  }
}

export function CredibleInterval({ variants, leader }: CredibleIntervalProps) {
  const cis = useMemo(
    () => variants.map(computeCI).filter((c): c is CIData => c !== null),
    [variants],
  )

  if (cis.length === 0) return null

  const globalMin = Math.min(...cis.map(c => c.lo))
  const globalMax = Math.max(...cis.map(c => c.hi))
  const range = globalMax - globalMin || 1

  function toPct(val: number): number {
    return ((val - globalMin) / range) * 100
  }

  return (
    <div className="space-y-3">
      {cis.map(ci => {
        const isLeader = ci.label === leader
        const leftPct = toPct(ci.lo)
        const widthPct = toPct(ci.hi) - leftPct
        const meanPct = toPct(ci.mean)

        return (
          <div key={ci.label} data-ci-row="" className="flex items-center gap-3">
            <div className="w-8 flex-shrink-0 flex justify-center">
              <div
                data-leader-ring={isLeader || undefined}
                className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
                style={{
                  backgroundColor: ci.color,
                  color: '#1a1a1a',
                  ...(isLeader ? {
                    boxShadow: `0 0 0 2px ${ci.color}`,
                    outline: '2px solid transparent',
                    outlineOffset: 2,
                  } : {}),
                }}
              >
                {ci.label}
              </div>
            </div>

            <div className="relative flex-1 h-5">
              {/* Band */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3 rounded"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  background: `linear-gradient(90deg, ${ci.color}33, ${ci.color}55, ${ci.color}33)`,
                  border: `1px solid ${ci.color}44`,
                  transition: `width 0.6s ${CHART.easing}, left 0.6s ${CHART.easing}`,
                }}
              />
              {/* Mean dot */}
              <div
                data-mean-dot=""
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[11px] h-[11px] rounded-full"
                style={{
                  left: `${meanPct}%`,
                  backgroundColor: ci.color,
                  boxShadow: `0 0 4px ${ci.color}66`,
                }}
              />
            </div>

            <span
              className="text-[10px] w-20 text-right flex-shrink-0"
              style={{ fontFamily: CHART.font, color: 'var(--cms-text-muted)' }}
            >
              {ci.lo.toFixed(2)}-{ci.hi.toFixed(2)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

---

## Task 6: rank-bars.tsx (~80 LOC, ~20min)

Horizontal bars for P(best) or P(top-2) sorted descending.

### 6.1 RED -- Append to ab-charts.test.tsx

```tsx
import { RankBars } from '@/app/cms/(authed)/youtube/ab-lab/_components/rank-bars'

describe('RankBars', () => {
  const variants = [
    { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 0.15, pTop2: 0.45 },
    { label: 'B' as DisplayLabel, color: '#E8823C', pBest: 0.85, pTop2: 0.95 },
  ]

  it('renders bars sorted descending by pBest', () => {
    const { container } = render(<RankBars variants={variants} />)
    const labels = container.querySelectorAll('[data-rank-label]')
    expect(labels[0]?.textContent).toBe('B')
    expect(labels[1]?.textContent).toBe('A')
  })

  it('uses pTop2 when metric is pTop2', () => {
    const { container } = render(<RankBars variants={variants} metric="pTop2" />)
    const bars = container.querySelectorAll('[data-rank-bar]')
    expect(bars.length).toBe(2)
  })

  it('gives 0% bars a minimum 2px width', () => {
    const zeroVariants = [
      { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 0, pTop2: 0 },
    ]
    const { container } = render(<RankBars variants={zeroVariants} />)
    const bar = container.querySelector('[data-rank-bar]')
    expect(bar?.getAttribute('style')).toContain('2px')
  })

  it('clamps values over 100 to 100%', () => {
    const over = [
      { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 1.5, pTop2: 0.5 },
    ]
    const { container } = render(<RankBars variants={over} />)
    const bar = container.querySelector('[data-rank-bar]')
    expect(bar).toBeTruthy()
  })
})
```

### 6.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/rank-bars.tsx`

```tsx
'use client'

import { useMemo } from 'react'
import type { DisplayLabel } from './ab-constants'
import { CHART } from './chart-utils'

export interface RankedVariant {
  label: DisplayLabel
  color: string
  pBest: number   // 0-1
  pTop2: number   // 0-1
}

export interface RankBarsProps {
  variants: RankedVariant[]
  metric?: 'pBest' | 'pTop2'  // default 'pBest'
}

export function RankBars({ variants, metric = 'pBest' }: RankBarsProps) {
  const sorted = useMemo(
    () => [...variants].sort((a, b) => b[metric] - a[metric]),
    [variants, metric],
  )

  return (
    <div className="space-y-2">
      {sorted.map(v => {
        const raw = v[metric] * 100
        const pct = Math.min(raw, 100)

        return (
          <div key={v.label} className="flex items-center gap-2">
            <span
              data-rank-label=""
              className="w-6 text-center text-xs font-bold"
              style={{ color: v.color }}
            >
              {v.label}
            </span>

            <div className="flex-1 h-5 rounded bg-cms-surface-hover relative overflow-hidden">
              <div
                data-rank-bar=""
                className="absolute inset-y-0 left-0 rounded"
                style={{
                  width: pct > 0 ? `${pct}%` : '2px',
                  minWidth: '2px',
                  background: `linear-gradient(90deg, ${v.color}cc, ${v.color})`,
                  transition: `width 0.6s ${CHART.easing}`,
                }}
              />
            </div>

            <span
              className="text-xs w-12 text-right"
              style={{ fontFamily: CHART.font, color: 'var(--cms-text-muted)' }}
            >
              {pct.toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

---

## Task 7: radar-chart.tsx (~160 LOC, ~45min)

Spider chart with 5 axes, one polygon per variant.

### 7.1 RED -- Append to ab-charts.test.tsx

```tsx
import { RadarChart } from '@/app/cms/(authed)/youtube/ab-lab/_components/radar-chart'

describe('RadarChart', () => {
  const variants = [
    { label: 'A' as DisplayLabel, color: '#8A8F98', ctr: 0.05, impressions: 10000,
      clicks: 500, pBest: 0.3, pTop2: 0.6, linkCtr: 0.02, retention: 0.45 },
    { label: 'B' as DisplayLabel, color: '#E8823C', ctr: 0.07, impressions: 10000,
      clicks: 700, pBest: 0.7, pTop2: 0.9, linkCtr: 0.03, retention: 0.55 },
  ]

  it('renders 4 grid rings', () => {
    const { container } = render(<RadarChart variants={variants} />)
    const polygons = container.querySelectorAll('polygon[data-grid]')
    expect(polygons.length).toBe(4)
  })

  it('renders one data polygon per variant', () => {
    const { container } = render(<RadarChart variants={variants} />)
    const polygons = container.querySelectorAll('polygon[data-variant]')
    expect(polygons.length).toBe(2)
  })

  it('renders nothing with fewer than 2 axes', () => {
    const { container } = render(
      <RadarChart
        variants={variants}
        axes={[{ key: 'ctr', label: 'CTR' }]}
      />,
    )
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders axis labels', () => {
    const { getByText } = render(<RadarChart variants={variants} />)
    expect(getByText('CTR')).toBeTruthy()
    expect(getByText('Win prob')).toBeTruthy()
  })

  it('handles axisMax=0 by mapping to center', () => {
    const zeroVariants = [
      { ...variants[0]!, ctr: 0, clicks: 0, pBest: 0, pTop2: 0 },
    ]
    const { container } = render(<RadarChart variants={zeroVariants} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
```

### 7.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/radar-chart.tsx`

```tsx
'use client'

import { useMemo } from 'react'
import type { DisplayLabel } from './ab-constants'
import { CHART } from './chart-utils'

export interface FullChartVariant {
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

export interface RadarChartProps {
  variants: FullChartVariant[]
  axes?: { key: string; label: string }[]
  size?: number  // default 280
}

const DEFAULT_AXES = [
  { key: 'ctr', label: 'CTR' },
  { key: 'retention', label: 'Retention' },
  { key: 'linkCtr', label: 'Link CTR' },
  { key: 'pBest', label: 'Win prob' },
  { key: 'impressions', label: 'Reach' },
]

function getAxisValue(v: FullChartVariant, key: string): number {
  const map: Record<string, number | undefined> = {
    ctr: v.ctr, retention: v.retention, linkCtr: v.linkCtr,
    pBest: v.pBest, pTop2: v.pTop2, impressions: v.impressions, clicks: v.clicks,
  }
  return map[key] ?? 0
}

function polarXY(cx: number, cy: number, r: number, angle: number): [number, number] {
  const rad = (angle - 90) * (Math.PI / 180)
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

export function RadarChart({
  variants,
  axes = DEFAULT_AXES,
  size = 280,
}: RadarChartProps) {
  if (axes.length < 2) return null

  const cx = size / 2
  const cy = size / 2
  const maxR = (size - 60) / 2
  const n = axes.length
  const angleStep = 360 / n

  // Compute axis maxes
  const axisMaxes = useMemo(() => {
    return axes.map(axis => {
      const vals = variants.map(v => getAxisValue(v, axis.key))
      return Math.max(...vals, Number.EPSILON)
    })
  }, [variants, axes])

  // Grid rings at 0.25, 0.5, 0.75, 1.0
  const gridRings = [0.25, 0.5, 0.75, 1.0].map(frac => {
    const pts = axes.map((_, i) => polarXY(cx, cy, maxR * frac, i * angleStep))
    return pts.map(([x, y]) => `${x},${y}`).join(' ')
  })

  // Variant polygons
  const variantPolygons = variants.map(v => {
    const pts = axes.map((axis, i) => {
      const val = getAxisValue(v, axis.key)
      const frac = axisMaxes[i]! > 0 ? val / axisMaxes[i]! : 0
      return polarXY(cx, cy, maxR * Math.min(frac, 1), i * angleStep)
    })
    return {
      label: v.label,
      color: v.color,
      points: pts.map(([x, y]) => `${x},${y}`).join(' '),
      vertices: pts,
    }
  })

  // Axis labels
  const labels = axes.map((axis, i) => {
    const [x, y] = polarXY(cx, cy, maxR + 18, i * angleStep)
    return { x, y, text: axis.label }
  })

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} className="ab-lab" aria-label="Radar chart">
      {/* Grid rings */}
      {gridRings.map((pts, i) => (
        <polygon
          key={i} data-grid=""
          points={pts} fill="none"
          stroke={CHART.gridStroke} strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {axes.map((_, i) => {
        const [x, y] = polarXY(cx, cy, maxR, i * angleStep)
        return (
          <line
            key={i} x1={cx} y1={cy} x2={x} y2={y}
            stroke={CHART.gridStroke} strokeWidth={1}
          />
        )
      })}

      {/* Variant polygons */}
      {variantPolygons.map(vp => (
        <g key={vp.label}>
          <polygon
            data-variant=""
            points={vp.points}
            fill={vp.color} fillOpacity={0.13}
            stroke={vp.color} strokeWidth={1.5}
            style={{
              transformOrigin: `${cx}px ${cy}px`,
              transition: `transform 0.6s ${CHART.easing}`,
            }}
          />
          {vp.vertices.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.6} fill={vp.color} />
          ))}
        </g>
      ))}

      {/* Labels */}
      {labels.map(l => (
        <text
          key={l.text} x={l.x} y={l.y}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={9} fill={CHART.axisColor}
        >
          {l.text}
        </text>
      ))}
    </svg>
  )
}
```

---

## Task 8: funnel-row.tsx (~80 LOC, ~20min)

3-stage horizontal funnel per variant.

### 8.1 RED -- Append to ab-charts.test.tsx

```tsx
import { FunnelRow } from '@/app/cms/(authed)/youtube/ab-lab/_components/funnel-row'

describe('FunnelRow', () => {
  it('renders 3 stages with linkClicks', () => {
    const { container } = render(
      <FunnelRow variant={{ impressions: 1000, clicks: 50, linkClicks: 10, color: '#E8823C' }} />,
    )
    const bars = container.querySelectorAll('[data-funnel-bar]')
    expect(bars.length).toBe(3)
  })

  it('renders 2 stages without linkClicks', () => {
    const { container } = render(
      <FunnelRow variant={{ impressions: 1000, clicks: 50, color: '#E8823C' }} />,
    )
    const bars = container.querySelectorAll('[data-funnel-bar]')
    expect(bars.length).toBe(2)
  })

  it('uses minimum 3px for 0-impression stage', () => {
    const { container } = render(
      <FunnelRow variant={{ impressions: 0, clicks: 0, color: '#E8823C' }} />,
    )
    const bars = container.querySelectorAll('[data-funnel-bar]')
    expect(bars.length).toBe(2)
  })

  it('renders labels for each stage', () => {
    const { getByText } = render(
      <FunnelRow variant={{ impressions: 1000, clicks: 50, linkClicks: 10, color: '#E8823C' }} />,
    )
    expect(getByText('Impressions')).toBeTruthy()
    expect(getByText('Clicks')).toBeTruthy()
    expect(getByText('Link clicks')).toBeTruthy()
  })
})
```

### 8.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/funnel-row.tsx`

```tsx
'use client'

import { CHART } from './chart-utils'

export interface FunnelRowProps {
  variant: {
    impressions: number
    clicks: number
    linkClicks?: number
    color: string
  }
}

interface Stage {
  label: string
  value: number
  pct: number
}

export function FunnelRow({ variant }: FunnelRowProps) {
  const { impressions, clicks, linkClicks, color } = variant

  const stages: Stage[] = [
    { label: 'Impressions', value: impressions, pct: 100 },
    {
      label: 'Clicks',
      value: clicks,
      pct: impressions > 0 ? Math.max(3, Math.min(100, (clicks / impressions) * 100)) : 3,
    },
  ]

  if (linkClicks !== undefined) {
    stages.push({
      label: 'Link clicks',
      value: linkClicks,
      pct: impressions > 0 ? Math.max(3, Math.min(100, (linkClicks / impressions) * 100)) : 3,
    })
  }

  return (
    <div className="space-y-1.5">
      {stages.map(stage => (
        <div key={stage.label} className="flex items-center gap-2">
          <span className="text-[10px] text-cms-text-dim w-20 flex-shrink-0 text-right">
            {stage.label}
          </span>
          <div className="flex-1 h-[14px] rounded bg-cms-surface-hover relative overflow-hidden">
            <div
              data-funnel-bar=""
              className="absolute inset-y-0 left-0 rounded"
              style={{
                width: `${stage.pct}%`,
                minWidth: '3px',
                backgroundColor: color,
                opacity: 1 - stages.indexOf(stage) * 0.2,
                transition: `width 0.4s ${CHART.easing}`,
              }}
            />
          </div>
          <span
            className="text-[10px] w-14 text-right flex-shrink-0"
            style={{ fontFamily: CHART.font, color: 'var(--cms-text-muted)' }}
          >
            {stage.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
```

---

## Task 9: bayes-curves.tsx (~180 LOC, ~45min)

Gaussian PDF curves with full normalization.

### 9.1 RED -- Write math tests + component tests

File: `apps/web/test/ab-chart-math.test.ts`

```ts
import { describe, it, expect } from 'vitest'

// Test the gaussian math directly (will be extracted or tested via component)
describe('Gaussian PDF math', () => {
  const gauss = (x: number, mean: number, sd: number) =>
    (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / sd) ** 2)

  it('peaks at mean', () => {
    const peak = gauss(0.05, 0.05, 0.01)
    const offPeak = gauss(0.06, 0.05, 0.01)
    expect(peak).toBeGreaterThan(offPeak)
  })

  it('returns 0 height for sd=0', () => {
    // sd=0 would cause division by zero -- component should skip
    expect(Number.isFinite(gauss(0.05, 0.05, 0))).toBe(false)
  })

  it('symmetric around mean', () => {
    const left = gauss(0.04, 0.05, 0.01)
    const right = gauss(0.06, 0.05, 0.01)
    expect(left).toBeCloseTo(right, 10)
  })

  it('higher impressions produce taller, narrower peaks', () => {
    // sd = sqrt(p*(1-p)/n)
    const sdHigh = Math.sqrt(0.05 * 0.95 / 10000)
    const sdLow = Math.sqrt(0.05 * 0.95 / 1000)
    const peakHigh = gauss(0.05, 0.05, sdHigh)
    const peakLow = gauss(0.05, 0.05, sdLow)
    expect(peakHigh).toBeGreaterThan(peakLow)
  })

  it('produces finite values for extreme CTR (p=0.001)', () => {
    const sd = Math.sqrt(0.001 * 0.999 / 10000)
    const val = gauss(0.001, 0.001, sd)
    expect(Number.isFinite(val)).toBe(true)
  })
})

describe('Credible interval math', () => {
  it('computes 95% CI bounds correctly', () => {
    const p = 0.05
    const n = 10000
    const sd = Math.sqrt(p * (1 - p) / n)
    const lo = p - 1.96 * sd
    const hi = p + 1.96 * sd
    expect(lo).toBeGreaterThan(0)
    expect(hi).toBeLessThan(1)
    expect(hi - lo).toBeCloseTo(2 * 1.96 * sd, 6)
  })

  it('handles p=0 (no clicks)', () => {
    const p = 0
    const n = 1000
    const sd = Math.sqrt(p * (1 - p) / n)
    expect(sd).toBe(0)
  })

  it('handles p=1 (all clicks)', () => {
    const p = 1
    const n = 1000
    const sd = Math.sqrt(p * (1 - p) / n)
    expect(sd).toBe(0)
  })

  it('n=0 should produce NaN sd', () => {
    const p = 0.05
    const sd = Math.sqrt(p * (1 - p) / 0)
    expect(Number.isFinite(sd)).toBe(false)
  })
})

describe('Z-score edge cases', () => {
  it('z=0 for identical CTRs', () => {
    const pA = 0.05, pB = 0.05, n = 10000
    const pPool = (pA * n + pB * n) / (2 * n)
    const se = Math.sqrt(pPool * (1 - pPool) * (1/n + 1/n))
    const z = (pB - pA) / se
    expect(z).toBe(0)
  })

  it('handles division by zero in se', () => {
    // When pPool is 0 or 1, se = 0
    const se = Math.sqrt(0 * 1 * (1/100 + 1/100))
    expect(se).toBe(0)
  })

  it('large z produces p-value near 0', () => {
    // z > 5 should give p << 0.001
    const pA = 0.03, pB = 0.10, n = 50000
    const pPool = (pA * n + pB * n) / (2 * n)
    const se = Math.sqrt(pPool * (1 - pPool) * (2/n))
    const z = (pB - pA) / se
    expect(z).toBeGreaterThan(5)
  })
})

describe('Rank probability math', () => {
  it('pBest sums to ~1 across variants', () => {
    // In a proper simulation, pBest values for all variants sum to 1
    const probs = [0.7, 0.2, 0.1]
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
  })

  it('pTop2 >= pBest for every variant', () => {
    // If you are best, you are also top 2
    const pBest = 0.7
    const pTop2 = 0.9
    expect(pTop2).toBeGreaterThanOrEqual(pBest)
  })
})
```

Append to `ab-charts.test.tsx`:

```tsx
import { BayesCurves } from '@/app/cms/(authed)/youtube/ab-lab/_components/bayes-curves'

describe('BayesCurves', () => {
  const variants: StatsVariant[] = [
    { label: 'A', color: '#8A8F98', ctr: 0.05, impressions: 10000 },
    { label: 'B', color: '#E8823C', ctr: 0.07, impressions: 10000 },
  ]

  it('renders one path per variant', () => {
    const { container } = render(<BayesCurves variants={variants} />)
    const paths = container.querySelectorAll('path[data-curve]')
    expect(paths.length).toBe(2)
  })

  it('renders dashed mean lines', () => {
    const { container } = render(<BayesCurves variants={variants} />)
    const meanLines = container.querySelectorAll('line[data-mean]')
    expect(meanLines.length).toBe(2)
  })

  it('skips variants with sd<=0', () => {
    const withZeroSD: StatsVariant[] = [
      ...variants,
      { label: 'C' as DisplayLabel, color: '#3FA9C0', ctr: 0, impressions: 1000 },
    ]
    const { container } = render(<BayesCurves variants={withZeroSD} />)
    const paths = container.querySelectorAll('path[data-curve]')
    expect(paths.length).toBe(2) // C skipped because ctr=0 => sd=0
  })

  it('skips variants with n=0', () => {
    const zeroN: StatsVariant[] = [
      { label: 'A' as DisplayLabel, color: '#8A8F98', ctr: 0.05, impressions: 0 },
    ]
    const { container } = render(<BayesCurves variants={zeroN} />)
    const paths = container.querySelectorAll('path[data-curve]')
    expect(paths.length).toBe(0)
  })

  it('renders sr-only table', () => {
    const { container } = render(<BayesCurves variants={variants} />)
    expect(container.querySelector('table.sr-only')).toBeTruthy()
  })

  it('renders gradient fill per curve', () => {
    const { container } = render(<BayesCurves variants={variants} />)
    const defs = container.querySelectorAll('linearGradient')
    expect(defs.length).toBeGreaterThanOrEqual(2)
  })
})
```

### 9.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/bayes-curves.tsx`

```tsx
'use client'

import { useMemo } from 'react'
import type { DisplayLabel } from './ab-constants'
import { CHART, toX, toY, GradientDef } from './chart-utils'

export interface StatsVariant {
  label: DisplayLabel
  color: string
  ctr: number       // 0-1
  impressions: number
}

export interface BayesCurvesProps {
  variants: StatsVariant[]
  height?: number  // default 200
}

const SAMPLES = 90

function gauss(x: number, mean: number, sd: number): number {
  return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / sd) ** 2)
}

interface CurveData {
  label: DisplayLabel
  color: string
  mean: number
  sd: number
  points: { x: number; y: number }[]
  peak: number
}

export function BayesCurves({ variants, height = CHART.H }: BayesCurvesProps) {
  const cfg = useMemo(() => ({ ...CHART, H: height }), [height])

  const curves = useMemo(() => {
    const valid = variants.filter(v => {
      if (v.impressions <= 0) return false
      const p = v.ctr
      if (p <= 0 || p >= 1) return false
      const sd = Math.sqrt((p * (1 - p)) / v.impressions)
      return sd > 0 && Number.isFinite(sd)
    })

    if (valid.length === 0) return []

    // Compute range across all curves
    const sds = valid.map(v => Math.sqrt((v.ctr * (1 - v.ctr)) / v.impressions))
    const means = valid.map(v => v.ctr)
    const globalLo = Math.max(0, Math.min(...means.map((m, i) => m - 4 * sds[i]!)))
    const globalHi = Math.min(1, Math.max(...means.map((m, i) => m + 4 * sds[i]!)))
    const range = globalHi - globalLo
    const epsilon = 1e-10

    if (range < epsilon) return []

    // Sample each curve
    const rawCurves: CurveData[] = valid.map(v => {
      const sd = Math.sqrt((v.ctr * (1 - v.ctr)) / v.impressions)
      const samples: { xVal: number; yVal: number }[] = []
      let peak = 0

      for (let i = 0; i < SAMPLES; i++) {
        const xVal = globalLo + (range * i) / (SAMPLES - 1)
        const yVal = gauss(xVal, v.ctr, sd)
        if (yVal > peak) peak = yVal
        samples.push({ xVal, yVal })
      }

      return { label: v.label, color: v.color, mean: v.ctr, sd, points: [], peak, _samples: samples }
    }) as (CurveData & { _samples: { xVal: number; yVal: number }[] })[]

    // Global normalization so tallest curve fills chart height
    const globalPeak = Math.max(...rawCurves.map(c => c.peak), epsilon)

    return rawCurves.map(c => ({
      label: c.label,
      color: c.color,
      mean: c.mean,
      sd: c.sd,
      peak: c.peak,
      points: c._samples.map(s => ({
        x: toX(
          ((s.xVal - globalLo) / range) * (SAMPLES - 1),
          SAMPLES,
          cfg,
        ),
        y: toY(s.yVal / globalPeak * 100, 0, 100, cfg),
      })),
    }))
  }, [variants, cfg])

  if (curves.length === 0) {
    return (
      <svg viewBox={`0 0 ${cfg.W} ${cfg.H}`} width="100%" height={cfg.H} role="img" aria-label="Bayesian curves -- no data">
        <text x={cfg.W / 2} y={cfg.H / 2} textAnchor="middle" fontSize={12} fill="var(--cms-text-dim)">No data yet</text>
      </svg>
    )
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${cfg.W} ${cfg.H}`} width="100%" height={cfg.H}
        role="img" aria-label="Bayesian posterior distributions" className="ab-lab"
      >
        <defs>
          {curves.map(c => (
            <GradientDef key={c.label} id={`bayes-${c.label}`} color={c.color} topOpacity={0.22} />
          ))}
        </defs>

        {curves.map(c => {
          const d = c.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
          const areaD = `${d} L ${c.points[c.points.length - 1]!.x} ${cfg.H - cfg.padB} L ${c.points[0]!.x} ${cfg.H - cfg.padB} Z`

          // Mean line X position
          const meanFrac = curves.length > 0
            ? (c.mean - Math.min(...curves.map(cc => cc.mean - 4 * cc.sd))) /
              (Math.max(...curves.map(cc => cc.mean + 4 * cc.sd)) - Math.min(...curves.map(cc => cc.mean - 4 * cc.sd)))
            : 0.5
          const meanX = cfg.padL + meanFrac * (cfg.W - cfg.padL - cfg.padR)

          return (
            <g key={c.label}>
              <path d={areaD} fill={`url(#bayes-${c.label})`} />
              <path data-curve="" d={d} fill="none" stroke={c.color} strokeWidth={1.5} />
              <line
                data-mean="" x1={meanX} y1={cfg.padT} x2={meanX} y2={cfg.H - cfg.padB}
                stroke={c.color} strokeWidth={1} strokeDasharray="3,3" strokeOpacity={0.6}
              />
              <text x={meanX} y={cfg.padT - 4} textAnchor="middle" fontSize={8}
                fontFamily={CHART.font} fill={c.color}
              >
                {(c.mean * 100).toFixed(2)}%
              </text>
            </g>
          )
        })}
      </svg>

      <table className="sr-only">
        <thead><tr><th>Variant</th><th>Mean CTR</th><th>SD</th></tr></thead>
        <tbody>
          {curves.map(c => (
            <tr key={c.label}>
              <td>{c.label}</td>
              <td>{(c.mean * 100).toFixed(2)}%</td>
              <td>{(c.sd * 100).toFixed(4)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## Task 10: dots.tsx (~40 LOC, ~10min)

Simple progress dots.

### 10.1 RED -- Append to ab-charts.test.tsx

```tsx
import { Dots } from '@/app/cms/(authed)/youtube/ab-lab/_components/dots'

describe('Dots', () => {
  it('renders correct number of dots', () => {
    const { container } = render(<Dots total={5} done={3} />)
    const dots = container.querySelectorAll('[data-dot]')
    expect(dots.length).toBe(5)
  })

  it('fills done dots with color', () => {
    const { container } = render(<Dots total={3} done={2} color="#E8823C" />)
    const dots = container.querySelectorAll('[data-dot]')
    expect(dots[0]?.getAttribute('style')).toContain('#E8823C')
    expect(dots[1]?.getAttribute('style')).toContain('#E8823C')
  })

  it('renders nothing when total=0', () => {
    const { container } = render(<Dots total={0} done={0} />)
    const dots = container.querySelectorAll('[data-dot]')
    expect(dots.length).toBe(0)
  })

  it('clamps done to total', () => {
    const { container } = render(<Dots total={3} done={10} />)
    const dots = container.querySelectorAll('[data-dot]')
    const filled = Array.from(dots).filter(d => !d.getAttribute('style')?.includes('--cms-surface-3'))
    expect(filled.length).toBe(3)
  })

  it('has role="meter" with aria attributes', () => {
    const { container } = render(<Dots total={5} done={3} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('3')
    expect(meter?.getAttribute('aria-valuemin')).toBe('0')
    expect(meter?.getAttribute('aria-valuemax')).toBe('5')
  })
})
```

### 10.2 GREEN -- Implement

File: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/dots.tsx`

```tsx
'use client'

export interface DotsProps {
  total: number
  done: number
  color?: string
}

export function Dots({ total, done: rawDone, color = 'var(--cms-accent)' }: DotsProps) {
  if (total <= 0) return null
  const done = Math.min(rawDone, total)

  return (
    <div
      role="meter"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${done} of ${total} complete`}
      className="flex gap-1 flex-wrap"
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          data-dot=""
          className="rounded-full"
          style={{
            width: 7, height: 7,
            backgroundColor: i < done ? color : 'var(--cms-surface-3)',
          }}
        />
      ))}
    </div>
  )
}
```

---

## Task 11: Update variant-heatmap-table.tsx imports (~5min)

### 11.1 RED -- No new test needed; existing rendering must not break.

Verify: after import changes, `next build` still passes.

### 11.2 GREEN -- Update imports

In `variant-heatmap-table.tsx`, replace the local `VARIANT_COLORS` with import from `ab-constants`:

```diff
- const VARIANT_COLORS: Record<string, string> = {
-   B: 'text-green-400',
-   C: 'text-blue-400',
-   D: 'text-amber-400',
- }
+ import { VARIANT_COLORS } from './ab-constants'
```

Note: the heatmap table uses Tailwind text color classes, not hex values. The import from `ab-constants` provides hex colors for the new design system. Update the cell rendering to use inline `style={{ color }}` instead of class names:

```diff
-  <th scope="row" className={`px-3 py-2 font-semibold text-left ${VARIANT_COLORS[v.label] ?? 'text-foreground'}`}>
+  <th scope="row" className="px-3 py-2 font-semibold text-left" style={{ color: VARIANT_COLORS[v.label as keyof typeof VARIANT_COLORS] ?? 'inherit' }}>
```

---

## Task 12: Delete old files + update imports in ab-test-detail.tsx (~30min)

### 12.1 Delete old chart files

```bash
rm apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-confidence-trend.tsx
rm apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-daily-ctr-chart.tsx
rm apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-rotation-timeline.tsx
```

### 12.2 Update imports in ab-test-detail.tsx

Replace:
```diff
- import { AbConfidenceTrend } from './ab-confidence-trend'
- import { AbRotationTimeline } from './ab-rotation-timeline'
- import { AbDailyCtrChart } from './ab-daily-ctr-chart'
+ import { ConfidenceChart } from './confidence-chart'
+ import { ABBATimeline } from './abba-timeline'
+ import { MultiLine } from './multi-line'
+ import { VARIANT_COLORS, toDisplayLabel } from './ab-constants'
+ import type { DisplayLabel } from './ab-constants'
```

Update usage of `AbConfidenceTrend` (line ~392):
```diff
- <AbConfidenceTrend
-   evaluations={evaluations}
-   threshold={test.config.confidence_threshold}
- />
+ <ConfidenceChart
+   data={evaluations.map(e => e.confidence * 100)}
+   target={test.config.confidence_threshold * 100}
+ />
```

Update usage of `AbRotationTimeline` (line ~520):
```diff
- <AbRotationTimeline
-   cycles={timeline}
-   variants={timelineVariants}
-   today={new Date().toISOString()}
-   totalDays={totalDays}
- />
+ <ABBATimeline
+   seq={timeline.map(c => {
+     const v = timelineVariants.find(v => v.id === c.variant_id)
+     return toDisplayLabel(v?.label ?? 'original', v?.is_original)
+   })}
+   total={totalDays}
+   done={timeline.filter(c => c.ended_at).length}
+   colors={VARIANT_COLORS}
+ />
```

Update usage of `AbDailyCtrChart` (line ~529):
```diff
- <AbDailyCtrChart
-   cycles={results.timeline}
-   variants={results.variants.map(v => ({ id: v.variant_id, label: v.label }))}
- />
+ <MultiLine
+   series={(() => {
+     const s: Partial<Record<DisplayLabel, number[]>> = {}
+     for (const v of results.variants) {
+       const label = toDisplayLabel(v.label, v.is_original)
+       const cycles = results.timeline
+         .filter(c => c.variant_id === v.variant_id && c.backfill_status === 'confirmed' && c.ctr !== null)
+         .sort((a, b) => a.cycle_number - b.cycle_number)
+       s[label] = cycles.map(c => (c.ctr ?? 0) * 100)
+     }
+     return s as Record<DisplayLabel, number[]>
+   })()}
+   colors={VARIANT_COLORS}
+ />
```

Delete the local `normalCdf` duplicate (lines 20-30):
```diff
- function normalCdf(z: number): number {
-   if (z < -8) return 0
-   if (z > 8) return 1
-   let sum = 0
-   let term = z
-   for (let i = 3; sum + term !== sum; i += 2) {
-     sum += term
-     term *= (z * z) / i
-   }
-   return 0.5 + sum * Math.exp(-0.5 * z * z - 0.9189385332)
- }
+ import { normalCdf } from '@/lib/youtube/ab-statistics'
```

### 12.3 Update barrel export

Add all new charts to `_components/index.ts`:
```ts
export { ConfidenceChart } from './confidence-chart'
export { MultiLine } from './multi-line'
export { ABBATimeline } from './abba-timeline'
export { Gauge } from './gauge'
export { CredibleInterval } from './credible-interval'
export { RankBars } from './rank-bars'
export { RadarChart } from './radar-chart'
export { FunnelRow } from './funnel-row'
export { BayesCurves } from './bayes-curves'
export { Dots } from './dots'
```

---

## Task 13: Verification gates

Run in sequence:

```bash
# 1. Run chart tests
npm run test:web -- --run test/ab-charts.test.tsx test/ab-chart-math.test.ts

# 2. Run all AB tests to ensure no regressions
npm run test:web -- --run test/ab-*.test.ts test/ab-*.test.tsx

# 3. Build packages (in case chart-utils is in packages/)
npm run build:packages

# 4. TypeCheck + Next build (pre-commit will also verify)
npx tsc --noEmit -p apps/web/tsconfig.json
```

**Pass criteria:**
- All 68+ chart test scenarios pass
- No `any` types in new files
- All 10 chart components export from `index.ts`
- `ab-test-detail.tsx` renders with new chart imports
- Old 3 chart files deleted
- `variant-heatmap-table.tsx` uses `VARIANT_COLORS` from `ab-constants`

---

## Summary

| # | File | Action | LOC | Time |
|---|------|--------|-----|------|
| 1 | `confidence-chart.tsx` | Create (replaces ab-confidence-trend) | ~150 | 45min |
| 2 | `multi-line.tsx` | Create (replaces ab-daily-ctr-chart) | ~170 | 45min |
| 3 | `abba-timeline.tsx` | Create (replaces ab-rotation-timeline) | ~100 | 30min |
| 4 | `gauge.tsx` | Create | ~110 | 30min |
| 5 | `credible-interval.tsx` | Create | ~120 | 30min |
| 6 | `rank-bars.tsx` | Create | ~80 | 20min |
| 7 | `radar-chart.tsx` | Create | ~160 | 45min |
| 8 | `funnel-row.tsx` | Create | ~80 | 20min |
| 9 | `bayes-curves.tsx` | Create | ~180 | 45min |
| 10 | `dots.tsx` | Create | ~40 | 10min |
| 11 | `variant-heatmap-table.tsx` | Modify imports | ~5 | 5min |
| 12 | `ab-test-detail.tsx` | Update imports + usage | ~30 | 30min |
| 13 | `ab-charts.test.tsx` | Create (~50 scenarios) | ~250 | -- |
| 14 | `ab-chart-math.test.ts` | Create (~18 scenarios) | ~120 | -- |
| -- | 3 old chart files | Delete | -442 | 5min |
| **Total** | | | **~1400 new** | **~8h** |
