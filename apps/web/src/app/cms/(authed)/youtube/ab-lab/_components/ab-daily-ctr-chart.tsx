'use client'

import { useMemo } from 'react'
import type { AbTestCycleRow } from '@/lib/youtube/ab-types'

interface AbDailyCtrChartProps {
  cycles: AbTestCycleRow[]
  variants: Array<{ id: string; label: string }>
}

const VARIANT_COLORS: Record<string, string> = {
  original: '#4b5563',
  variant_b: '#3b82f6',
  variant_c: '#a855f7',
  variant_d: '#14b8a6',
}

export function AbDailyCtrChart({ cycles, variants }: AbDailyCtrChartProps) {
  const confirmedCycles = useMemo(
    () => cycles.filter(c => c.backfill_status === 'confirmed' && c.ctr !== null),
    [cycles],
  )

  const variantLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of variants) map.set(v.id, v.label)
    return map
  }, [variants])

  const chartData = useMemo(() => {
    return confirmedCycles
      .sort((a, b) => a.cycle_number - b.cycle_number)
      .map(c => ({
        cycle: c.cycle_number + 1,
        ctr: (c.ctr ?? 0) * 100,
        label: variantLabelMap.get(c.variant_id) ?? 'unknown',
        color: VARIANT_COLORS[variantLabelMap.get(c.variant_id) ?? ''] ?? '#6b7280',
      }))
  }, [confirmedCycles, variantLabelMap])

  if (chartData.length === 0) {
    return (
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-6 text-center">
        <p className="text-sm text-cms-text-muted">
          No confirmed CTR data yet. Data appears after backfill (48-72h delay).
        </p>
      </div>
    )
  }

  const maxCtr = Math.max(...chartData.map(d => d.ctr), 1)
  const svgWidth = 600
  const svgHeight = 140
  const padLeft = 35
  const padRight = 10
  const padTop = 10
  const padBottom = 25
  const chartW = svgWidth - padLeft - padRight
  const chartH = svgHeight - padTop - padBottom
  const barWidth = Math.min(Math.floor(chartW / chartData.length) - 2, 24)

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-cms-text-dim">Daily CTR</h4>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height={svgHeight}
          aria-label="Daily CTR chart"
        >
          {/* Y-axis grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => {
            const y = padTop + chartH * (1 - pct)
            return (
              <g key={pct}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <text
                  x={padLeft - 4}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={8}
                  fill="currentColor"
                  fillOpacity={0.4}
                >
                  {(maxCtr * pct).toFixed(1)}%
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {chartData.map((d, i) => {
            const x =
              padLeft +
              (i * (chartW / chartData.length)) +
              (chartW / chartData.length - barWidth) / 2
            const h = (d.ctr / maxCtr) * chartH
            const y = padTop + chartH - h
            return (
              <g key={i}>
                <rect x={x} y={y} width={barWidth} height={h} fill={d.color} rx={2} opacity={0.85} />
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - 6}
                  textAnchor="middle"
                  fontSize={7}
                  fill="currentColor"
                  fillOpacity={0.35}
                >
                  {d.cycle}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {variants.map(v => (
          <div key={v.id} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: VARIANT_COLORS[v.label] ?? '#6b7280' }}
            />
            <span className="text-xs text-cms-text-muted">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
