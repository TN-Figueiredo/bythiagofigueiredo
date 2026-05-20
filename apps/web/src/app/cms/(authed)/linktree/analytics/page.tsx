import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AnalyticsCharts, ClickMap, AiInsightsPanel } from '@tn-figueiredo/links-admin/client'
import type {
  DeviceData,
  ReferrerData,
  GeoDataItem,
  HourlyData,
  Insight,
} from '@tn-figueiredo/links-admin'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import { getLinktreeInsights } from '@/lib/linktree/insights'
import { LinktreeClicksTable } from './_components/linktree-clicks-table'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ period?: string }>
}

const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }

export default async function LinktreeAnalyticsPage({ searchParams }: Props) {
  const sp = await searchParams
  const { siteId, timezone } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  // Date range
  const period = sp.period ?? '30d'
  const days = PERIOD_DAYS[period] ?? 30
  const dateFrom = toDateStringInTz(new Date(Date.now() - days * 86_400_000), timezone)
  const dateTo = toDateStringInTz(new Date(), timezone)

  const supabase = getSupabaseServiceClient()

  const [metricsRes, eventsRes, insights] = await Promise.all([
    supabase
      .from('linktree_daily_metrics')
      .select(
        'date, pageviews, unique_visitors, link_clicks, bot_views, mobile_views, desktop_views, tablet_views, ref_direct, ref_search, ref_social, ref_email, ref_referral, ref_other, countries, hourly_views, link_clicks_by_key',
      )
      .eq('site_id', siteId)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true }),
    supabase
      .from('linktree_events')
      .select('country, device_type, browser, os, referrer_domain, created_at')
      .eq('site_id', siteId)
      .gte('created_at', `${dateFrom}T00:00:00Z`)
      .lte('created_at', `${dateTo}T23:59:59Z`)
      .order('created_at', { ascending: false })
      .limit(5000),
    getLinktreeInsights(siteId, dateFrom, dateTo),
  ])

  const dailyMetrics = metricsRes.data ?? []
  const events = eventsRes.data ?? []

  // Aggregate totals
  const totalViews = dailyMetrics.reduce((s, m) => s + (m.pageviews as number), 0)
  const totalUniqueVisitors = dailyMetrics.reduce((s, m) => s + (m.unique_visitors as number), 0)
  const totalLinkClicks = dailyMetrics.reduce((s, m) => s + (m.link_clicks as number), 0)
  const engagementRate = totalViews > 0 ? (totalLinkClicks / totalViews) * 100 : 0

  // Per-link click aggregation
  const allClicksByKey: Record<string, number> = {}
  for (const m of dailyMetrics) {
    const byKey = m.link_clicks_by_key as Record<string, number>
    for (const [key, count] of Object.entries(byKey)) {
      allClicksByKey[key] = (allClicksByKey[key] ?? 0) + count
    }
  }

  // Geo aggregation from daily metrics (more reliable than event samples)
  const countryMap = new Map<string, number>()
  for (const m of dailyMetrics) {
    const countries = m.countries as Record<string, number> | null
    if (countries) {
      for (const [c, n] of Object.entries(countries)) {
        countryMap.set(c, (countryMap.get(c) ?? 0) + n)
      }
    }
  }

  // Device / browser / OS / referrer from event samples
  const deviceMap = new Map<string, number>()
  const browserMap = new Map<string, number>()
  const osMap = new Map<string, number>()
  const referrerMap = new Map<string, number>()

  for (const ev of events) {
    const device = (ev.device_type as string) || 'Unknown'
    deviceMap.set(device, (deviceMap.get(device) ?? 0) + 1)

    const browser = (ev.browser as string) || 'Unknown'
    browserMap.set(browser, (browserMap.get(browser) ?? 0) + 1)

    const os = (ev.os as string) || 'Unknown'
    osMap.set(os, (osMap.get(os) ?? 0) + 1)

    const referrer = (ev.referrer_domain as string) || 'Direct'
    referrerMap.set(referrer, (referrerMap.get(referrer) ?? 0) + 1)
  }

  function topN(m: Map<string, number>, n = 10) {
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }))
  }

  // Hourly heatmap from last 7 days
  const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  const last7 = dailyMetrics.slice(-7)
  for (let dayIdx = 0; dayIdx < last7.length; dayIdx++) {
    const m = last7[dayIdx]
    if (!m) continue
    const hourly = m.hourly_views as number[] | null
    if (Array.isArray(hourly)) {
      for (let h = 0; h < 24; h++) {
        if (matrix[dayIdx]) {
          matrix[dayIdx]![h] = hourly[h] ?? 0
        }
      }
    }
  }

  // Build data shapes for analytics components
  const dailyClicksForChart = dailyMetrics.map((m) => ({
    date: m.date as string,
    clicks: (m.pageviews as number) ?? 0,
    unique: (m.unique_visitors as number) ?? 0,
  }))

  const analyticsMetricsForCharts = {
    totalClicks: totalViews,
    uniqueVisitors: totalUniqueVisitors,
    conversionRate: null,
    topCountry: null,
    dailyClicks: dailyClicksForChart,
  }

  const deviceData: DeviceData = {
    device: topN(deviceMap),
    browser: topN(browserMap),
    os: topN(osMap),
  }

  const referrerData: ReferrerData = {
    items: Array.from(referrerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count })),
  }

  const geoData: GeoDataItem[] = Array.from(countryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([country, count]) => ({ country, count }))

  const hourlyData: HourlyData = { matrix }

  const insightsList: Insight[] = insights

  // SVG chart helpers
  const chartWidth = 600
  const chartHeight = 120
  const chartPad = 8
  const innerWidth = chartWidth - chartPad * 2
  const innerHeight = chartHeight - chartPad * 2

  const maxViews = Math.max(...dailyMetrics.map((m) => m.pageviews as number), 1)

  function buildPolyline(values: number[], color: string, opacity = 1): string {
    if (values.length === 0) return ''
    const pts = values.map((v, i) => {
      const x = chartPad + (i / Math.max(values.length - 1, 1)) * innerWidth
      const y = chartPad + (1 - v / maxViews) * innerHeight
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" opacity="${opacity}" />`
  }

  const viewValues = dailyMetrics.map((m) => m.pageviews as number)
  const uniqueValues = dailyMetrics.map((m) => m.unique_visitors as number)
  const polyViews = buildPolyline(viewValues, 'hsl(var(--primary))')
  const polyUnique = buildPolyline(uniqueValues, 'hsl(var(--primary))', 0.4)

  const periods: Array<{ label: string; value: string }> = [
    { label: '7 dias', value: '7d' },
    { label: '30 dias', value: '30d' },
    { label: '90 dias', value: '90d' },
    { label: '1 ano', value: '365d' },
  ]

  return (
    <div className="flex flex-col gap-6 px-4 py-4 md:px-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analytics — Linktree</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {dateFrom} → {dateTo}
          </p>
        </div>
        <div className="flex gap-1">
          {periods.map((p) => (
            <a
              key={p.value}
              href={`?period=${p.value}`}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground border border-border'
              }`}
            >
              {p.label}
            </a>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total de Views</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalViews.toLocaleString('pt-BR')}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">pageviews no período</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Últimos {days} dias</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{days}d</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {dateFrom} → {dateTo}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Visitantes Únicos</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {totalUniqueVisitors.toLocaleString('pt-BR')}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">unique visitors</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Engagement</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{engagementRate.toFixed(1)}%</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {totalLinkClicks.toLocaleString('pt-BR')} clicks / {totalViews.toLocaleString('pt-BR')} views
          </p>
        </div>
      </div>

      {/* Daily chart (SVG polyline) */}
      {dailyMetrics.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Pageviews por dia</p>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 bg-primary" /> Views
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 bg-primary/40" /> Únicos
              </span>
            </div>
          </div>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full"
            style={{ height: 120 }}
            aria-hidden="true"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: polyViews + polyUnique }}
          />
        </div>
      )}

      {/* Clicks per link */}
      {Object.keys(allClicksByKey).length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Clicks por link</p>
          <LinktreeClicksTable clicksByKey={allClicksByKey} totalClicks={totalLinkClicks} />
        </div>
      )}

      {/* Device / browser / OS / referrer charts */}
      <AnalyticsCharts
        metrics={analyticsMetricsForCharts}
        deviceData={deviceData}
        referrerData={referrerData}
        geoData={geoData}
        hourlyData={hourlyData}
      />

      {/* Geo map + AI insights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ClickMap geoData={geoData} />
        <div className="space-y-4">
          <AiInsightsPanel insights={insightsList} isLoading={false} />
        </div>
      </div>
    </div>
  )
}
