'use client'

import Link from 'next/link'
import type { DashboardKpisData } from '@tn-figueiredo/cms-admin/dashboard/client'

interface ContentPerformanceCardProps {
  kpis: DashboardKpisData
}

interface MetricRowProps {
  label: string
  value: number | string
  color: string
  barPct: number
}

function MetricRow({ label, value, color, barPct }: MetricRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-cms-text-dim">{label}</span>
        <span className="font-semibold text-cms-text tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-cms-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(barPct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function ContentPerformanceCard({ kpis }: ContentPerformanceCardProps) {
  const max = Math.max(
    kpis.publishedLast30d,
    kpis.newsletterOpens,
    kpis.campaignLeads,
    kpis.confirmedSubscribers,
    1, // guard division-by-zero
  )

  const pct = (v: number) => Math.round((v / max) * 100)

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 flex-1">
        <MetricRow
          label="Posts published (30d)"
          value={kpis.publishedLast30d}
          color="var(--cms-accent, #6366f1)"
          barPct={pct(kpis.publishedLast30d)}
        />
        <MetricRow
          label="Newsletter opens (30d)"
          value={kpis.newsletterOpens}
          color="var(--cms-green, #22c55e)"
          barPct={pct(kpis.newsletterOpens)}
        />
        <MetricRow
          label="Campaign leads (30d)"
          value={kpis.campaignLeads}
          color="var(--cms-amber, #f59e0b)"
          barPct={pct(kpis.campaignLeads)}
        />
        <MetricRow
          label="Active subscribers"
          value={kpis.confirmedSubscribers}
          color="var(--cms-cyan, #06b6d4)"
          barPct={pct(kpis.confirmedSubscribers)}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-cms-border flex items-center justify-between">
        <span className="text-[11px] text-cms-text-dim">Last 30 days</span>
        <Link
          href="/cms/analytics"
          className="text-[12px] font-medium text-cms-accent hover:underline"
        >
          View full analytics →
        </Link>
      </div>
    </div>
  )
}
