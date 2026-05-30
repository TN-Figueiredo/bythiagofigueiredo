import { SparklineSvg, type SparklineSvgProps } from './sparkline-svg'

/* ------------------------------------------------------------------ */
/*  Shared KpiCard — consolidated from dashboard-kpi-grid + social    */
/* ------------------------------------------------------------------ */

export interface KpiTrend {
  direction: 'up' | 'down' | 'flat'
  /** Display label, e.g. "+12%", "-3", "estavel" */
  label: string
}

export interface KpiCardProps {
  /** Short uppercase label above the value */
  label: string
  /** Formatted display value (e.g. "1.2K", "R$ 450") */
  value: string
  /** Optional trend indicator with directional color */
  trend?: KpiTrend
  /** Optional sparkline data points (needs >= 2 points) */
  sparkline?: number[]
  /** Sparkline color — defaults to `var(--acc)` */
  sparklineColor?: string
  /** Sparkline variant — defaults to `line` */
  sparklineVariant?: SparklineSvgProps['variant']
  /** `data-testid` attribute */
  testId?: string
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

/**
 * Reusable KPI card with optional trend arrow and sparkline.
 *
 * Used across dashboard, analytics, social insights, and newsletters.
 * Follows the design-system card pattern: rounded-xl, border, inset glow.
 */
export function KpiCard({
  label,
  value,
  trend,
  sparkline,
  sparklineColor,
  sparklineVariant,
  testId,
}: KpiCardProps) {
  const ariaLabel = trend
    ? `${label}: ${value}, ${trend.direction === 'up' ? 'crescente' : trend.direction === 'down' ? 'decrescente' : 'estavel'} ${trend.label}`
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
        {sparkline && sparkline.length >= 2 && (
          <SparklineSvg
            data={sparkline}
            color={sparklineColor ?? 'var(--acc)'}
            variant={sparklineVariant}
          />
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
