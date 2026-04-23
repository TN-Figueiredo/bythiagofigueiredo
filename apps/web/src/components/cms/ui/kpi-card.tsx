'use client'

import { Sparkline } from './sparkline'

interface KpiCardProps {
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down' | 'flat'; label: string }
  trendPositive?: 'up' | 'down'
  sparklinePoints?: number[]
  color?: 'default' | 'green' | 'amber' | 'red' | 'cyan'
}

const COLOR_MAP = {
  default: 'text-cms-text',
  green: 'text-cms-green',
  amber: 'text-cms-amber',
  red: 'text-cms-red',
  cyan: 'text-cms-cyan',
} as const

export function KpiCard({ label, value, trend, trendPositive = 'up', sparklinePoints, color = 'default' }: KpiCardProps) {
  const isPositive = trend?.direction === (trendPositive ?? 'up')
  const trendColor = !trend ? '' : isPositive ? 'text-cms-green' : trend.direction === 'flat' ? 'text-cms-text-dim' : 'text-cms-red'

  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] text-cms-text-dim uppercase tracking-wide">{label}</div>
          <div className={`text-2xl font-semibold mt-1 ${COLOR_MAP[color]}`}>{value}</div>
          {trend && (
            <div className={`text-[11px] mt-1 ${trendColor}`} aria-label={`${label} ${value}, ${trend.direction === 'up' ? 'up' : trend.direction === 'down' ? 'down' : 'flat'} ${trend.label}`}>
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.label}
            </div>
          )}
        </div>
        {sparklinePoints && sparklinePoints.length > 1 && (
          <Sparkline points={sparklinePoints} color={isPositive ? 'var(--cms-green)' : 'var(--cms-red)'} className="mt-1" />
        )}
      </div>
    </div>
  )
}
