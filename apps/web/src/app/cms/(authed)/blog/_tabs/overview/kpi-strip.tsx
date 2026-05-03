'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { SparklineSvg } from '../../_shared/sparkline-svg'
import type { OverviewTabData } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'

interface KpiStripProps {
  kpis: OverviewTabData['kpis']
  sparklines: OverviewTabData['sparklines']
  strings?: BlogHubStrings
}

export function KpiStrip({ kpis, sparklines, strings }: KpiStripProps) {
  const s = strings?.kpi
  const KPI_DEFS = [
    {
      key: 'totalPosts' as const,
      sparkKey: 'totalPosts' as const,
      label: s?.totalPosts ?? 'Total Posts',
      format: (v: number) => v.toLocaleString(),
      trend: kpis.totalPostsTrend,
      inverted: false,
    },
    {
      key: 'published' as const,
      sparkKey: 'published' as const,
      label: s?.published ?? 'Published',
      format: (v: number) => v.toLocaleString(),
      trend: kpis.publishedTrend,
      inverted: false,
    },
    {
      key: 'avgReadingTime' as const,
      sparkKey: 'avgReadingTime' as const,
      label: s?.avgReadingTime ?? 'Avg Reading Time',
      format: (v: number) => `${v.toFixed(1)} min`,
      trend: kpis.avgReadingTimeTrend,
      inverted: false,
    },
    {
      key: 'draftBacklog' as const,
      sparkKey: 'draftBacklog' as const,
      label: s?.draftBacklog ?? 'Draft Backlog',
      format: (v: number) => v.toString(),
      trend: kpis.draftBacklogTrend,
      inverted: true,
    },
  ] as const

  return (
    <div
      className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:flex lg:overflow-x-auto"
      role="list"
      aria-label="Key performance indicators"
    >
      {KPI_DEFS.map((def) => {
        const trend = def.trend
        const isPositive = def.inverted ? trend < 0 : trend > 0
        return (
          <div
            key={def.key}
            role="listitem"
            className="flex min-w-0 flex-col rounded-[10px] border border-gray-800 bg-gray-900 px-4 py-3 transition-colors hover:border-gray-700 lg:min-w-[160px] lg:flex-1"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              {def.label}
            </span>
            <span className="mt-1 text-xl font-extrabold tabular-nums text-gray-100">
              {def.format(kpis[def.key])}
            </span>
            {trend !== 0 && (
              <span
                className={`mt-1 flex items-center gap-0.5 text-[9px] font-medium ${
                  isPositive ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                {trend > 0 ? '+' : ''}
                {trend}
              </span>
            )}
            <div className="mt-2">
              <SparklineSvg
                data={sparklines[def.sparkKey]}
                color={isPositive ? '#22c55e' : trend < 0 && !def.inverted ? '#ef4444' : '#6366f1'}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
