import type { KpiQueryResult } from './dashboard-queries'
import { formatNumber } from '../_shared/format-number'

interface DashboardKpiGridProps {
  data: KpiQueryResult
}

interface KpiCardProps {
  label: string
  value: string
  trend?: { direction: 'up' | 'down' | 'flat'; label: string }
  sparkline?: number[]
  sparklineColor?: string
  testId: string
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null

  const max = Math.max(...points, 1)
  const width = 64
  const height = 24
  const step = width / (points.length - 1)

  const pathPoints = points
    .map((v, i) => `${i * step},${height - (v / max) * height}`)
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <polyline
        points={pathPoints}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrendArrow({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'flat') return null
  const isUp = direction === 'up'
  return (
    <span className={`text-xs ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
      {isUp ? '↑' : '↓'}
    </span>
  )
}

function KpiCard({ label, value, trend, sparkline, sparklineColor, testId }: KpiCardProps) {
  const ariaLabel = trend
    ? `${label}: ${value}, tendência ${trend.direction === 'up' ? 'crescente' : trend.direction === 'down' ? 'decrescente' : 'estável'} ${trend.label}`
    : `${label}: ${value}`

  return (
    <div
      className="flex flex-col justify-between rounded-xl border border-[var(--bdr-1)] bg-[var(--bg-2)]/40 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
      data-testid={testId}
      role="group"
      aria-label={ariaLabel}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--t5)]">
          {label}
        </span>
        {sparkline && (
          <Sparkline points={sparkline} color={sparklineColor ?? 'var(--acc)'} />
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-bold leading-none text-[var(--t1)] tabular-nums">
          {value}
        </span>
        {trend && trend.direction !== 'flat' && (
          <span className="flex items-center gap-0.5">
            <TrendArrow direction={trend.direction} />
            <span
              className={`text-[11px] font-medium ${
                trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {trend.label}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

export function DashboardKpiGrid({ data }: DashboardKpiGridProps) {
  const cards: KpiCardProps[] = [
    {
      label: 'Total Views',
      value: formatNumber(data.totalViews),
      sparkline: data.totalViewsSparkline,
      sparklineColor: 'var(--color-blog)',
      testId: 'kpi-total-views',
    },
    {
      label: 'Publicados',
      value: formatNumber(data.publishedCount),
      trend: undefined,
      testId: 'kpi-publicados',
    },
    {
      label: 'Assinantes',
      value: formatNumber(data.subscribers),
      trend:
        data.subscribersNet !== 0
          ? {
              direction: data.subscribersNet > 0 ? 'up' : 'down',
              label: `${data.subscribersNet > 0 ? '+' : ''}${data.subscribersNet}`,
            }
          : undefined,
      sparklineColor: 'var(--color-newsletter)',
      testId: 'kpi-assinantes',
    },
    {
      label: 'Link Clicks',
      value: formatNumber(data.linkClicks),
      sparkline: data.linkClicksSparkline,
      sparklineColor: 'var(--color-link)',
      testId: 'kpi-link-clicks',
    },
    {
      label: 'Receita',
      value: data.revenue !== null ? formatNumber(data.revenue) : '--',
      testId: 'kpi-receita',
    },
  ]

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      data-testid="kpi-grid"
    >
      {cards.map((card) => (
        <KpiCard key={card.testId} {...card} />
      ))}
    </div>
  )
}
