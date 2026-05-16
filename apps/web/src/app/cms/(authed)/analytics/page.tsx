import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  fetchKpiData,
  fetchFunnelData,
  fetchTopLinks,
  fetchClicksDestination,
  fetchClicksSource,
  fetchClicksChart,
} from '@/lib/analytics/analytics-queries'
import { AnalyticsHeader } from './_components/analytics-header'
import { AnalyticsOverview } from './_components/analytics-overview'
import type { PeriodInput, AnalyticsTab, AnalyticsOverviewData } from './types'

const ComingSoonStub = dynamic(() => import('./_components/coming-soon-stub'))

interface Props {
  searchParams: Promise<{
    tab?: string
    period?: string
    start?: string
    end?: string
  }>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId, timezone, primaryDomain } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const periodValue = params.period ?? '30d'
  const VALID_TABS: AnalyticsTab[] = ['overview', 'content', 'links', 'newsletter', 'audience']
  const activeTab: AnalyticsTab = VALID_TABS.includes(params.tab as AnalyticsTab)
    ? (params.tab as AnalyticsTab)
    : 'overview'

  let periodInput: PeriodInput
  if (periodValue === 'custom' && params.start && params.end) {
    periodInput = { type: 'custom', start: params.start, end: params.end }
  } else {
    const preset = periodValue === '7d' || periodValue === '90d' ? periodValue : '30d'
    periodInput = { type: 'preset', value: preset }
  }

  // Only fetch data for overview tab
  let overviewData: AnalyticsOverviewData | null = null
  if (activeTab === 'overview') {
    const siteOrigin = primaryDomain
      ? `https://${primaryDomain}`
      : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

    const [kpis, funnel, topLinks, destinations, sources, clicksChart] = await Promise.all([
      fetchKpiData(siteId, periodInput, timezone),
      fetchFunnelData(siteId, periodInput, timezone),
      fetchTopLinks(siteId, periodInput, siteOrigin),
      fetchClicksDestination(siteId, periodInput, siteOrigin),
      fetchClicksSource(siteId, periodInput),
      fetchClicksChart(siteId, periodInput, timezone),
    ])

    overviewData = { kpis, funnel, topLinks, destinations, sources, clicksChart }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-cms-bg">
      <AnalyticsHeader activeTab={activeTab} activePeriod={periodValue} />
      {activeTab === 'overview' && overviewData && (
        <AnalyticsOverview data={overviewData} />
      )}
      {activeTab !== 'overview' && (
        <ComingSoonStub tab={activeTab} />
      )}
    </div>
  )
}
