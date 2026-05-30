import type { AnalyticsOverviewData, FunnelData, ClickedLink } from '../types'
import { generateInsights } from '@/lib/analytics/insights-engine'
import { KpiRow } from './kpi-row'
import { ContentFunnel } from './content-funnel'
import { TopLinksTable } from './top-links-table'
import { ClicksDestinationGrid } from './clicks-destination'
import { ClicksSourceList } from './clicks-source'
import { ClicksChart } from './clicks-chart'
import { InsightsStrip } from './insights-strip'

interface Props {
  data: AnalyticsOverviewData
}

export function AnalyticsOverview({ data }: Props) {
  const insights = generateInsights(data.funnel, {
    topLinks: data.topLinks,
    totalClicks: data.destinations.inHouse + data.destinations.external + data.destinations.youtube + data.destinations.affiliate,
  })

  return (
    <div className="space-y-6 p-4 md:p-6">
      <KpiRow kpis={data.kpis} />
      {/* 2-col: Content Funnel + Traffic Sources (per spec) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ContentFunnel funnel={data.funnel} />
        <ClicksSourceList data={data.sources} />
      </div>
      <TopLinksTable links={data.topLinks} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ClicksDestinationGrid data={data.destinations} />
        <ClicksChart data={data.clicksChart} />
      </div>
      <InsightsStrip insights={insights} />
    </div>
  )
}
