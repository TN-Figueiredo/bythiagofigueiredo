import { notFound, redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  AnalyticsOverview,
  AnalyticsCharts,
  ClickMap,
  AiInsightsPanel,
} from '@tn-figueiredo/links-admin/client'
import type {
  AnalyticsMetrics,
  DeviceData,
  ReferrerData,
  GeoDataItem,
  HourlyData,
  Insight,
  DateRange,
} from '@tn-figueiredo/links-admin'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import { getAiInsights } from '../../actions'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ period?: string }>
}

export default async function LinkAnalyticsPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const { siteId, timezone } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  // Fetch link
  const { data: link, error: linkError } = await supabase
    .from('tracked_links')
    .select('id, title, code, destination_url, total_clicks, unique_visitors, created_at')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (linkError || !link) notFound()

  // Date range from search params (default: 30 days)
  const period = sp.period ?? '30d'
  const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }
  const days = daysMap[period] ?? 30
  const dateFrom = toDateStringInTz(new Date(Date.now() - days * 86_400_000), timezone)
  const dateTo = toDateStringInTz(new Date(), timezone)

  // Parallel fetches
  const [metricsRes, clickEventsRes, insightsResult] = await Promise.all([
    supabase
      .from('link_daily_metrics')
      .select('date, clicks, unique_visitors, mobile_clicks, desktop_clicks, tablet_clicks, ref_direct, ref_search, ref_social, ref_email, ref_referral, ref_other, countries, hourly_clicks')
      .eq('link_id', id)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true }),
    supabase
      .from('link_clicks')
      .select('country, device_type, browser, os, referrer_domain, clicked_at')
      .eq('link_id', id)
      .gte('clicked_at', `${dateFrom}T00:00:00Z`)
      .lte('clicked_at', `${dateTo}T23:59:59Z`)
      .order('clicked_at', { ascending: false })
      .limit(5000),
    getAiInsights(id),
  ])

  const dailyMetrics = metricsRes.data ?? []
  const clickEvents = clickEventsRes.data ?? []

  // Build analytics metrics
  const dailyClicks = dailyMetrics.map((m) => ({
    date: m.date as string,
    clicks: (m.clicks as number) ?? 0,
    unique: (m.unique_visitors as number) ?? 0,
  }))

  const periodClicks = dailyClicks.reduce((s, m) => s + m.clicks, 0)
  const periodUnique = dailyClicks.reduce((s, m) => s + m.unique, 0)

  // Aggregate geo from daily metrics (more accurate than click samples)
  const countryMap = new Map<string, number>()
  for (const m of dailyMetrics) {
    const countries = m.countries as Record<string, number> | null
    if (countries) {
      for (const [c, n] of Object.entries(countries)) {
        countryMap.set(c, (countryMap.get(c) ?? 0) + n)
      }
    }
  }

  let topCountry: string | null = null
  let topCountryCount = 0
  for (const [c, n] of countryMap) {
    if (n > topCountryCount) {
      topCountryCount = n
      topCountry = c
    }
  }

  // Build device/browser/os/referrer data from click events
  const deviceMap = new Map<string, number>()
  const browserMap = new Map<string, number>()
  const osMap = new Map<string, number>()
  const referrerMap = new Map<string, number>()

  for (const ev of clickEvents) {
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

  // Build hourly heatmap from daily metrics (7 days x 24 hours)
  const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  const last7 = dailyMetrics.slice(-7)
  for (let dayIdx = 0; dayIdx < last7.length; dayIdx++) {
    const m = last7[dayIdx]
    if (!m) continue
    const hourly = m.hourly_clicks as Record<string, number> | null
    if (hourly) {
      for (const [h, c] of Object.entries(hourly)) {
        const hour = parseInt(h, 10)
        if (hour >= 0 && hour < 24 && matrix[dayIdx]) {
          matrix[dayIdx]![hour] = c
        }
      }
    }
  }

  const analyticsMetrics: AnalyticsMetrics = {
    totalClicks: periodClicks,
    uniqueVisitors: periodUnique,
    conversionRate: null,
    topCountry,
    dailyClicks,
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

  const insights: Insight[] = insightsResult.ok
    ? (insightsResult.insights as Insight[])
    : []

  const dateRange: DateRange = {
    from: new Date(dateFrom),
    to: new Date(dateTo),
  }

  async function handleDateRangeChange(_range: DateRange) {
    'use server'
    // Date range changes handled via search params on client side
  }

  const linkTitle = (link.title as string) ?? null
  const linkCode = link.code as string

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Section 1: Toolbar ─────────────────────────────── */}
      <div style={{
        height: 52, flexShrink: 0,
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-side)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 14,
      }}>
        {/* Back button */}
        <a
          href={`/cms/links/${id}`}
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--ink-dim)',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, textDecoration: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Voltar
        </a>

        {/* Separator */}
        <div style={{ width: 1, height: 22, background: 'var(--line)' }} />

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'nowrap', minWidth: 0 }}>
          <a
            href="/cms/links"
            style={{
              fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 15l6-6" />
              <path d="M10 6l1-1a4 4 0 016 6l-1 1" />
              <path d="M14 18l-1 1a4 4 0 01-6-6l1-1" />
            </svg>
            Links
          </a>

          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }}>
            <path d="M9 6l6 6-6 6" />
          </svg>

          <a
            href={`/cms/links/${id}`}
            style={{
              fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            /{linkCode}
          </a>

          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }}>
            <path d="M9 6l6 6-6 6" />
          </svg>

          <span style={{
            fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 220, flexShrink: 1,
          }}>
            Analytics
          </span>
        </div>

        {/* Right: link title */}
        {linkTitle && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 280,
          }}>
            {linkTitle}
          </span>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <AnalyticsOverview
        metrics={analyticsMetrics}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
      />

      <AnalyticsCharts
        metrics={analyticsMetrics}
        deviceData={deviceData}
        referrerData={referrerData}
        geoData={geoData}
        hourlyData={hourlyData}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClickMap geoData={geoData} />

        <div className="space-y-4">
          <AiInsightsPanel
            insights={insights}
            isLoading={false}
          />
        </div>
      </div>
      </div> {/* end content */}
    </div>
  )
}
