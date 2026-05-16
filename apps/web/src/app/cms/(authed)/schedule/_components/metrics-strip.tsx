'use client'

import type { ScheduleMetrics } from '@/lib/schedule/schedule-queries'

interface MetricsStripProps {
  metrics: ScheduleMetrics
}

function StatCard({
  label,
  value,
  isAlert,
}: {
  label: string
  value: string | number
  isAlert?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold ${
          isAlert ? 'text-red-400' : 'text-slate-100'
        }`}
        data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {value}
      </p>
    </div>
  )
}

export function MetricsStrip({ metrics }: MetricsStripProps) {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
      data-testid="metrics-strip"
    >
      <StatCard label="Published this month" value={metrics.publishedThisMonth} />
      <StatCard label="Scheduled ahead" value={metrics.scheduledAhead} />
      <StatCard
        label="Cadence health"
        value={`${metrics.cadenceHealthPct}%`}
      />
      <StatCard
        label="Overdue"
        value={metrics.overdueCount}
        isAlert={metrics.overdueCount > 0}
      />
    </div>
  )
}
