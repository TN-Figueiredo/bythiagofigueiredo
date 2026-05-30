'use client'

import { useState, useCallback } from 'react'
import type { ClicksChartPoint } from '../types'

const CHART_HEIGHT = 200
const CHART_PADDING_TOP = 20
const CHART_PADDING_BOTTOM = 30
const CHART_PADDING_LEFT = 40
const CHART_PADDING_RIGHT = 16
const GRIDLINE_COUNT = 4
const BAR_COLOR = 'var(--acc)'
const GHOST_COLOR = 'var(--bg-3)'
const GHOST_OPACITY = 0.15
const AVG_LINE_COLOR = 'var(--color-blog)'

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${Number(month)}/${Number(day)}`
}

function niceMax(value: number): number {
  if (value <= 0) return 10
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / magnitude
  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

interface Props {
  data: ClicksChartPoint[]
}

export function ClicksChart({ data }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const handleBarHover = useCallback((index: number | null) => {
    setHoveredIndex(index)
  }, [])

  if (data.length === 0) {
    return (
      <div
        className="flex h-64 items-center justify-center rounded-[10px] border border-cms-border bg-cms-surface"
        data-testid="clicks-chart"
      >
        <p className="text-sm text-cms-text-muted">No click data for this period</p>
      </div>
    )
  }

  const maxCurrent = Math.max(...data.map((d) => d.current), 1)
  const maxPrev = Math.max(...data.map((d) => d.previous), 0)
  const maxValue = niceMax(Math.max(maxCurrent, maxPrev))

  const drawWidth = 800 - CHART_PADDING_LEFT - CHART_PADDING_RIGHT
  const drawHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM
  const barWidth = Math.min(Math.max(drawWidth / data.length - 2, 4), 20)
  const barGap = (drawWidth - barWidth * data.length) / data.length

  // Grid lines
  const gridLines: { y: number; label: string }[] = []
  for (let i = 0; i <= GRIDLINE_COUNT; i++) {
    const value = Math.round((maxValue / GRIDLINE_COUNT) * i)
    const y = CHART_PADDING_TOP + drawHeight - (value / maxValue) * drawHeight
    gridLines.push({ y, label: String(value) })
  }

  // Average line Y
  const avgValue = data.length > 0 ? data[0]!.average : 0
  const avgY = CHART_PADDING_TOP + drawHeight - (avgValue / maxValue) * drawHeight

  // Label interval
  const labelInterval = Math.max(1, Math.ceil(data.length / 10))

  return (
    <div className="rounded-[10px] border border-cms-border bg-cms-surface p-4" data-testid="clicks-chart">
      <h3 className="mb-3 text-sm font-medium text-cms-text-dim">Clicks Over Time</h3>
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 800 ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Bar chart showing daily link clicks"
        >
          {/* Grid lines */}
          {gridLines.map((gl, i) => (
            <g key={i}>
              <line
                x1={CHART_PADDING_LEFT}
                y1={gl.y}
                x2={800 - CHART_PADDING_RIGHT}
                y2={gl.y}
                stroke="var(--cms-border, #374151)"
                strokeDasharray="4 4"
                strokeWidth="0.5"
              />
              <text
                x={CHART_PADDING_LEFT - 6}
                y={gl.y + 3}
                textAnchor="end"
                fontSize="9"
                fill="var(--cms-text-muted, #9ca3af)"
              >
                {gl.label}
              </text>
            </g>
          ))}

          {/* Average line */}
          {avgValue > 0 && (
            <line
              x1={CHART_PADDING_LEFT}
              y1={avgY}
              x2={800 - CHART_PADDING_RIGHT}
              y2={avgY}
              stroke={AVG_LINE_COLOR}
              strokeWidth="1"
              strokeDasharray="6 3"
              opacity="0.8"
            />
          )}

          {/* Bars */}
          {data.map((point, i) => {
            const x = CHART_PADDING_LEFT + i * (barWidth + barGap) + barGap / 2
            const barHeight = (point.current / maxValue) * drawHeight
            const barY = CHART_PADDING_TOP + drawHeight - barHeight
            const ghostHeight = (point.previous / maxValue) * drawHeight
            const ghostY = CHART_PADDING_TOP + drawHeight - ghostHeight

            return (
              <g
                key={i}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${formatDateShort(point.date)}: ${point.current} clicks`}
                onMouseEnter={() => handleBarHover(i)}
                onMouseLeave={() => handleBarHover(null)}
                onFocus={() => handleBarHover(i)}
                onBlur={() => handleBarHover(null)}
              >
                {/* Ghost bar (previous) */}
                {point.previous > 0 && (
                  <rect
                    x={x}
                    y={ghostY}
                    width={barWidth}
                    height={ghostHeight}
                    fill={GHOST_COLOR}
                    opacity={GHOST_OPACITY}
                    rx="2"
                  />
                )}

                {/* Current bar */}
                <rect
                  x={x}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={BAR_COLOR}
                  rx="2"
                  opacity={hoveredIndex === i ? 1 : 0.85}
                />

                {/* X-axis label */}
                {i % labelInterval === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={CHART_HEIGHT - 6}
                    textAnchor="middle"
                    fontSize="8"
                    fill="var(--cms-text-muted, #9ca3af)"
                  >
                    {formatDateShort(point.date)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Tooltip */}
          {hoveredIndex !== null && data[hoveredIndex] && (() => {
            const point = data[hoveredIndex]!
            const x = CHART_PADDING_LEFT + hoveredIndex * (barWidth + barGap) + barGap / 2
            const tooltipX = Math.min(Math.max(x, 80), 720)
            return (
              <g>
                <rect
                  x={tooltipX - 45}
                  y={4}
                  width={90}
                  height={34}
                  rx="4"
                  fill="var(--cms-bg, #111827)"
                  stroke="var(--cms-border, #374151)"
                  strokeWidth="0.5"
                />
                <text x={tooltipX} y={16} textAnchor="middle" fontSize="8" fill="var(--cms-text-muted, #9ca3af)">
                  {formatDateShort(point.date)}
                </text>
                <text x={tooltipX} y={30} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--cms-text, #f9fafb)">
                  {point.current} clicks
                </text>
              </g>
            )
          })()}
        </svg>

        {/* Legend */}
        <div className="mt-2 flex items-center gap-4 text-[10px] text-cms-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: BAR_COLOR }} />
            Current
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: GHOST_COLOR, opacity: GHOST_OPACITY }} />
            Previous
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-px w-4" style={{ backgroundColor: AVG_LINE_COLOR, borderTop: `1px dashed ${AVG_LINE_COLOR}` }} />
            Avg
          </span>
        </div>
      </div>
    </div>
  )
}
