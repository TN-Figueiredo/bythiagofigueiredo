'use client'
import type { AnalyticsMetrics, DeviceData, ReferrerData, GeoDataItem, HourlyData } from '../types'

export interface AnalyticsChartsProps {
  metrics: AnalyticsMetrics
  deviceData: DeviceData
  referrerData: ReferrerData
  geoData: GeoDataItem[]
  hourlyData: HourlyData
}

function HorizontalBarChart({
  items,
  maxDisplay = 10,
}: {
  items: Array<{ name: string; count: number }>
  maxDisplay?: number
}) {
  const displayed = items.slice(0, maxDisplay)
  const max = Math.max(...displayed.map((d) => d.count), 1)
  return (
    <div className="space-y-1.5">
      {displayed.map((item) => (
        <div key={item.name} className="flex items-center gap-2 text-sm">
          <span className="w-24 truncate text-foreground">{item.name}</span>
          <div className="flex-1">
            <div
              className="h-4 rounded bg-blue-400"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right tabular-nums text-muted-foreground">{item.count}</span>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ items }: { items: Array<{ name: string; count: number }> }) {
  const total = items.reduce((sum, i) => sum + i.count, 0)
  if (total === 0) return <p className="text-sm text-muted-foreground">No data</p>

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
  let cumulative = 0

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 36 36" className="h-24 w-24">
        {items.map((item, idx) => {
          const pct = item.count / total
          const offset = cumulative
          cumulative += pct
          const dashArray = `${pct * 100} ${100 - pct * 100}`
          const dashOffset = 100 - offset * 100 + 25
          return (
            <circle
              key={item.name}
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke={colors[idx % colors.length]}
              strokeWidth="3"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            />
          )
        })}
      </svg>
      <div className="space-y-1 text-xs">
        {items.map((item, idx) => (
          <div key={item.name} className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colors[idx % colors.length] }}
            />
            <span>{item.name}</span>
            <span className="text-muted-foreground">({item.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HourlyHeatmap({ matrix }: { matrix: number[][] }) {
  if (matrix.length === 0) return <p className="text-sm text-muted-foreground">No data</p>
  const allValues = matrix.flat()
  const max = Math.max(...allValues, 1)
  const cellSize = 14
  const gap = 2

  return (
    <svg
      data-testid="hourly-heatmap"
      viewBox={`0 0 ${24 * (cellSize + gap)} ${7 * (cellSize + gap)}`}
      className="h-32 w-full"
    >
      {matrix.map((row, dayIdx) =>
        row.map((value, hourIdx) => {
          const opacity = value / max
          return (
            <rect
              key={`${dayIdx}-${hourIdx}`}
              x={hourIdx * (cellSize + gap)}
              y={dayIdx * (cellSize + gap)}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={`rgba(59, 130, 246, ${Math.max(opacity, 0.05)})`}
            />
          )
        }),
      )}
    </svg>
  )
}

export function AnalyticsCharts({
  deviceData,
  referrerData,
  geoData,
  hourlyData,
}: AnalyticsChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Device Donut */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Device</h3>
        <DonutChart items={deviceData.device} />
      </div>

      {/* Browser Bar */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Browser</h3>
        <HorizontalBarChart items={deviceData.browser} />
      </div>

      {/* OS Bar */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Operating System</h3>
        <HorizontalBarChart items={deviceData.os} />
      </div>

      {/* Referrer Bar */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Referrer</h3>
        <HorizontalBarChart
          items={referrerData.items.map((r) => ({ name: r.domain, count: r.count }))}
          maxDisplay={10}
        />
      </div>

      {/* Country Bar */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Countries</h3>
        <HorizontalBarChart
          items={geoData.map((g) => ({ name: g.country, count: g.count }))}
          maxDisplay={10}
        />
      </div>

      {/* Hourly Heatmap */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Hourly Heatmap</h3>
        <HourlyHeatmap matrix={hourlyData.matrix} />
      </div>
    </div>
  )
}
