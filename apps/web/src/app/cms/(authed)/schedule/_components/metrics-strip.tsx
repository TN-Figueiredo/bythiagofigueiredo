'use client'

import type { ScheduleMetrics } from '@/lib/schedule/schedule-queries'

interface MetricsStripProps {
  metrics: ScheduleMetrics
}

type StatTone = 'default' | 'success' | 'warning' | 'danger'

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: StatTone
}) {
  const borderBg: Record<StatTone, string> = {
    default: 'border-[var(--bdr-1)]/50 bg-[var(--bg-2)]/50',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    danger:  'border-red-500/30 bg-red-500/5',
  }
  const valueColor: Record<StatTone, string> = {
    default: 'text-[var(--t1)]',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger:  'text-red-400',
  }
  const isLive = tone === 'danger' || tone === 'warning'

  return (
    <div
      className={`rounded-[var(--radius-xl)] border px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${borderBg[tone]}`}
      role={isLive ? 'status' : 'group'}
      aria-label={`${label}: ${value}`}
      {...(isLive ? { 'aria-live': 'polite' as const } : {})}
    >
      <p className="text-2xs font-medium uppercase tracking-wide text-[var(--t3)]">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold ${valueColor[tone]}`}
        data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {value}
      </p>
    </div>
  )
}

function getCadenceTone(pct: number): StatTone {
  if (pct >= 80) return 'success'
  if (pct >= 50) return 'warning'
  return 'danger'
}

export function MetricsStrip({ metrics }: MetricsStripProps) {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
      data-testid="metrics-strip"
    >
      <StatCard label="Publicados este mês" value={metrics.publishedThisMonth} />
      <StatCard label="Agendados" value={metrics.scheduledAhead} />
      <StatCard
        label="Saúde da cadência"
        value={`${metrics.cadenceHealthPct}%`}
        tone={getCadenceTone(metrics.cadenceHealthPct)}
      />
      <StatCard
        label="Atrasados"
        value={metrics.overdueCount}
        tone={metrics.overdueCount > 0 ? 'danger' : 'default'}
      />
    </div>
  )
}
