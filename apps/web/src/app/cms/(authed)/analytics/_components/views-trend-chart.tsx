'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { ViewsTrendPoint } from '../types'

interface ViewsTrendChartProps {
  data: ViewsTrendPoint[]
  loading: boolean
}

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  const d = new Date(Number(dateStr.slice(0, 4)), Number(month) - 1, Number(day))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}

export function ViewsTrendChart({ data, loading }: ViewsTrendChartProps) {
  if (loading) {
    return (
      <div
        className="flex h-64 items-center justify-center rounded-lg border"
        style={{ borderColor: 'var(--cms-border)', background: 'var(--cms-surface)' }}
      >
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--cms-accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        className="flex h-64 items-center justify-center rounded-lg border"
        style={{ borderColor: 'var(--cms-border)', background: 'var(--cms-surface)' }}
      >
        <p className="text-sm" style={{ color: 'var(--cms-text-muted)' }}>
          No data for this period
        </p>
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF8240" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#FF8240" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="uniqueViewsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--cms-border)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            tick={{ fontSize: 11, fill: 'var(--cms-text-muted)' }}
            axisLine={{ stroke: 'var(--cms-border)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatNumber}
            tick={{ fontSize: 11, fill: 'var(--cms-text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--cms-surface)',
              border: '1px solid var(--cms-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={formatDateShort}
            formatter={(value: number, name: string) => [
              formatNumber(value),
              name === 'views' ? 'Views' : 'Unique Views',
            ]}
          />
          <Area
            type="monotone"
            dataKey="views"
            stroke="#FF8240"
            strokeWidth={2}
            fill="url(#viewsGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#FF8240' }}
          />
          <Area
            type="monotone"
            dataKey="uniqueViews"
            stroke="#60a5fa"
            strokeWidth={2}
            fill="url(#uniqueViewsGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#60a5fa' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
