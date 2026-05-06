'use client'
import type { AnalyticsMetrics, DateRange } from '../types'

export interface AnalyticsOverviewProps {
  metrics: AnalyticsMetrics
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function ClicksLineChart({
  data,
}: {
  data: Array<{ date: string; clicks: number; unique: number }>
}) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.clicks), 1)
  const width = 600
  const height = 200
  const padding = 20
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const step = chartWidth / Math.max(data.length - 1, 1)

  const clicksPoints = data
    .map(
      (d, i) =>
        `${padding + i * step},${padding + chartHeight - (d.clicks / max) * chartHeight}`,
    )
    .join(' ')

  const uniquePoints = data
    .map(
      (d, i) =>
        `${padding + i * step},${padding + chartHeight - (d.unique / max) * chartHeight}`,
    )
    .join(' ')

  return (
    <svg
      data-testid="analytics-chart"
      viewBox={`0 0 ${width} ${height}`}
      className="h-48 w-full"
    >
      <polyline points={clicksPoints} fill="none" stroke="#3b82f6" strokeWidth="2" />
      <polyline
        points={uniquePoints}
        fill="none"
        stroke="#10b981"
        strokeWidth="2"
        strokeDasharray="4"
      />
    </svg>
  )
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export function AnalyticsOverview({
  metrics,
  dateRange,
  onDateRangeChange,
}: AnalyticsOverviewProps) {
  const handlePreset = (days: number) => {
    const to = new Date()
    const from = new Date(to.getTime() - days * 86400000)
    onDateRangeChange({ from, to })
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Clicks" value={formatNumber(metrics.totalClicks)} />
        <KpiCard label="Unique Visitors" value={formatNumber(metrics.uniqueVisitors)} />
        {metrics.conversionRate !== null && (
          <KpiCard
            label="Conversion Rate"
            value={`${(metrics.conversionRate * 100).toFixed(1)}%`}
          />
        )}
        {metrics.topCountry && <KpiCard label="Top Country" value={metrics.topCountry} />}
      </div>

      {/* Date Range Picker */}
      <div className="flex items-center gap-2" data-testid="date-range-picker">
        {PRESETS.map(({ label, days }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            onClick={() => handlePreset(days)}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ClicksLineChart data={metrics.dailyClicks} />
    </div>
  )
}
