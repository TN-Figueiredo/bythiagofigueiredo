'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { SparklineSvg } from '../../_shared/sparkline-svg'
import type { OverviewTabData } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'

interface KpiStripProps {
  kpis: OverviewTabData['kpis']
  sparklines: OverviewTabData['sparklines']
  strings?: NewsletterHubStrings
}

export function KpiStrip({ kpis, sparklines, strings }: KpiStripProps) {
  const KPI_DEFS = [
    { key: 'totalSubscribers' as const, sparkKey: 'subscribers' as const, label: strings?.kpi.totalSubscribers ?? 'Subscribers', format: (v: number) => v.toLocaleString(), suffix: '' },
    { key: 'editionsSent' as const, sparkKey: 'editions' as const, label: strings?.kpi.editionsSent ?? 'Editions Sent', format: (v: number) => v.toString(), suffix: '' },
    { key: 'avgOpenRate' as const, sparkKey: 'openRate' as const, label: strings?.kpi.avgOpenRate ?? 'Open Rate', format: (v: number) => `${v.toFixed(1)}%`, suffix: 'pp' },
    { key: 'avgClickRate' as const, sparkKey: 'clickRate' as const, label: strings?.kpi.avgClickRate ?? 'Click Rate', format: (v: number) => `${v.toFixed(1)}%`, suffix: 'pp' },
    { key: 'bounceRate' as const, sparkKey: 'bounceRate' as const, label: strings?.kpi.bounceRate ?? 'Bounce Rate', format: (v: number) => `${v.toFixed(1)}%`, suffix: 'pp', inverted: true },
  ] as const
  const trendKeys: Record<string, number> = {
    totalSubscribers: kpis.subscribersTrend,
    editionsSent: kpis.editionsThisMonth,
    avgOpenRate: kpis.openRateTrend,
    avgClickRate: kpis.clickRateTrend,
    bounceRate: kpis.bounceTrend,
  }

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:flex lg:overflow-x-auto" role="list" aria-label="Key performance indicators">
      {KPI_DEFS.map((def) => {
        const trend = trendKeys[def.key] ?? 0
        const isPositive = 'inverted' in def ? trend < 0 : trend > 0
        return (
          <div key={def.key} role="listitem" className="flex min-w-0 flex-col rounded-[10px] border border-gray-800 bg-gray-900 px-4 py-3 transition-colors hover:border-gray-700 lg:min-w-[160px] lg:flex-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{def.label}</span>
            <span className="mt-1 text-xl font-extrabold tabular-nums text-gray-100">{def.format(kpis[def.key])}</span>
            {trend !== 0 && (
              <span className={`mt-1 flex items-center gap-0.5 text-[9px] font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {trend > 0 ? '+' : ''}{def.suffix === 'pp' ? `${trend.toFixed(1)}pp` : trend}
              </span>
            )}
            <div className="mt-2">
              <SparklineSvg data={sparklines[def.sparkKey]} color={isPositive ? '#22c55e' : '#ef4444'} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
