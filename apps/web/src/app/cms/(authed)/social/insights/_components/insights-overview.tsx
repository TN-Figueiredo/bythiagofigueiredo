'use client'

import { KpiCard } from './kpi-card'
import { EngagementChart } from './engagement-chart'
import { PostingHeatmap } from './posting-heatmap'
import type { SocialStrings } from '../../_i18n/types'

interface InsightsData {
  kpis: { postsPublished: number; deliverySuccessRate: number; linkClicks: number; avgEngagement: number; aiDraftsApproved: number }
  chartData: { date: string; clicks: number; engagement: number; posts: number }[]
  heatmapData: { day: number; hour: number; value: number }[]
}

interface InsightsOverviewProps {
  data: InsightsData
  strings: SocialStrings
}

export function InsightsOverview({ data, strings: t }: InsightsOverviewProps) {
  const { kpis } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label={t.insights.kpi.postsPublished} value={String(kpis.postsPublished)} />
        <KpiCard label={t.insights.kpi.deliverySuccess} value={`${kpis.deliverySuccessRate}%`} />
        <KpiCard label={t.insights.kpi.linkClicks} value={kpis.linkClicks.toLocaleString()} />
        <KpiCard label={t.insights.kpi.avgEngagement} value={String(kpis.avgEngagement)} />
        <KpiCard label={t.insights.kpi.aiDraftsApproved} value={String(kpis.aiDraftsApproved)} />
      </div>

      <EngagementChart data={data.chartData} strings={t} />

      <PostingHeatmap data={data.heatmapData} strings={t} />
    </div>
  )
}
