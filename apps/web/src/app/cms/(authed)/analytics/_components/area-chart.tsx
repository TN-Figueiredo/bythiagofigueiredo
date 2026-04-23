'use client'

import { useMemo } from 'react'

interface DataPoint {
  label: string
  values: number[]
}

interface AreaChartSeries {
  name: string
  color: string
}

interface AreaChartProps {
  data: DataPoint[]
  series: AreaChartSeries[]
  height?: number
  todayIndex?: number
}

function normalise(points: number[], max: number, height: number, padding: number): string {
  if (points.length < 2) return ''
  const step = 100 / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = i * step
    const y = max > 0 ? padding + (1 - v / max) * (height - padding * 2) : height - padding
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  return coords.join(' ')
}

function buildAreaPath(coordStr: string, height: number): string {
  if (!coordStr) return ''
  const firstX = coordStr.split(' ')[0]?.split(',')[0] ?? '0'
  const lastX = coordStr.split(' ').at(-1)?.split(',')[0] ?? '100'
  return `M ${firstX},${height} L ${coordStr} L ${lastX},${height} Z`
}

export function AreaChart({ data, series, height = 180, todayIndex }: AreaChartProps) {
  const PADDING = 20
  const GRID_LINES = 4

  const maxVal = useMemo(() => {
    let max = 0
    for (const point of data) for (const v of point.values) if (v > max) max = v
    return max || 1
  }, [data])

  const seriesCoords = useMemo(
    () => series.map((_, si) => normalise(data.map((d) => d.values[si] ?? 0), maxVal, height, PADDING)),
    [data, series, maxVal, height],
  )

  const gridYValues = Array.from({ length: GRID_LINES + 1 }, (_, i) =>
    PADDING + (i / GRID_LINES) * (height - PADDING * 2),
  )

  const xLabels = data.length <= 12 ? data : data.filter((_, i) => i % Math.ceil(data.length / 6) === 0)

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        {gridYValues.map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="var(--cms-border, #2a2d3a)"
            strokeWidth="0.3"
          />
        ))}
        {todayIndex !== undefined && data.length > 1 && (
          <line
            x1={((todayIndex / (data.length - 1)) * 100).toFixed(2)}
            y1={PADDING}
            x2={((todayIndex / (data.length - 1)) * 100).toFixed(2)}
            y2={height - PADDING}
            stroke="var(--cms-accent, #6366f1)"
            strokeWidth="0.5"
            strokeDasharray="2 1"
          />
        )}
        {[...series].reverse().map((s, ri) => {
          const si = series.length - 1 - ri
          const coords = seriesCoords[si]
          if (!coords) return null
          return (
            <path
              key={s.name + '-area'}
              d={buildAreaPath(coords, height)}
              fill={s.color}
              opacity={0.15}
            />
          )
        })}
        {series.map((s, si) => {
          const coords = seriesCoords[si]
          if (!coords) return null
          return (
            <polyline
              key={s.name + '-line'}
              points={coords}
              fill="none"
              stroke={s.color}
              strokeWidth="1.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )
        })}
      </svg>
      <div
        className="absolute bottom-0 left-0 right-0 flex justify-between px-1"
        style={{ top: height - PADDING + 2 }}
      >
        {xLabels.map((d) => (
          <span key={d.label} className="text-[9px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>
            {d.label}
          </span>
        ))}
      </div>
      {todayIndex !== undefined && data[todayIndex] && (
        <div
          className="absolute text-[9px] font-medium px-1"
          style={{
            left: `${(todayIndex / (data.length - 1)) * 100}%`,
            top: PADDING - 14,
            transform: 'translateX(-50%)',
            color: 'var(--cms-accent, #6366f1)',
          }}
        >
          Today
        </div>
      )}
      <div className="absolute top-0 right-0 flex gap-3">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-[3px] rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>
              {s.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
