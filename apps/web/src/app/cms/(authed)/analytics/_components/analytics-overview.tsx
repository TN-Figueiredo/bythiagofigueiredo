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
    totalClicks: data.topLinks.reduce((s, l) => s + l.clicks, 0),
  })

  return (
    <div className="space-y-6 p-4 md:p-6">
      <KpiRow kpis={data.kpis} />
      <ContentFunnel funnel={data.funnel} />
      <TopLinksTable links={data.topLinks} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ClicksDestinationGrid data={data.destinations} />
        <ClicksSourceList data={data.sources} />
      </div>
      <ClicksChart data={data.clicksChart} />
      <InsightsStrip insights={insights} />
    </div>
  )
}
