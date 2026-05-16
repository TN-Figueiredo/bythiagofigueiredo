import type { KpiData } from '../types'

function formatValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

function trendArrow(current: number, previous: number | null): { text: string; color: string; arrow: string } | null {
  if (previous === null) return null
  if (previous === 0) {
    if (current === 0) return null
    return { text: '+100%', color: '#34d399', arrow: 'up' }
  }
  const delta = Math.round(((current - previous) / previous) * 100)
  if (delta === 0) return null
  return {
    text: `${delta >= 0 ? '+' : ''}${delta}%`,
    color: delta >= 0 ? '#34d399' : '#f87171',
    arrow: delta >= 0 ? 'up' : 'down',
  }
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null

  const max = Math.max(...data, 1)
  const w = 64
  const h = 20
  const step = w / (data.length - 1)

  const points = data.map((v, i) => {
    const x = i * step
    const y = h - (v / max) * (h - 2) - 1
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="#818cf8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface Props {
  kpis: KpiData[]
}

export function KpiRow({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="kpi-row">
      {kpis.map((kpi) => {
        const trend = trendArrow(kpi.value, kpi.previousValue)
        return (
          <div
            key={kpi.label}
            className="rounded-lg border border-cms-border bg-cms-surface p-4"
            data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-cms-text-muted">
              {kpi.label}
            </p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-2xl font-bold tabular-nums text-cms-text">
                {formatValue(kpi.value)}
              </p>
              {kpi.sparkline.length > 1 && <Sparkline data={kpi.sparkline} />}
            </div>
            {trend && (
              <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: trend.color }}>
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  {trend.arrow === 'up' ? (
                    <path d="M5 1 L9 6 L1 6 Z" fill="currentColor" />
                  ) : (
                    <path d="M5 9 L9 4 L1 4 Z" fill="currentColor" />
                  )}
                </svg>
                <span>{trend.text} vs prev</span>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
