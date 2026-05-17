import 'server-only'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import { classifyLink } from './link-classifier'
import { resolveDateRange, resolvePrevDateRange, getDaysBetween } from './date-range'
import type {
  PeriodInput,
  KpiData,
  FunnelData,
  ClickedLink,
  ClicksDestination,
  ClicksSource,
  ClicksChartPoint,
} from '@/app/cms/(authed)/analytics/types'

/* ------------------------------------------------------------------ */
/*  KPI Data                                                          */
/* ------------------------------------------------------------------ */

export async function fetchKpiData(
  siteId: string,
  period: PeriodInput,
  timezone: string,
): Promise<KpiData[]> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)
  const prevRange = resolvePrevDateRange(period)
  const days = getDaysBetween(start, end)

  // Current period — all independent queries in parallel
  const [currentMetricsRes, subCountRes, editionsRes, linkClickRes] = await Promise.all([
    supabase
      .from('content_metrics')
      .select('date, views, unique_views, reads_complete, avg_read_depth, avg_time_sec')
      .eq('site_id', siteId)
      .gte('date', toDateStringInTz(start, timezone))
      .lte('date', toDateStringInTz(end, timezone)),
    supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'confirmed'),
    supabase
      .from('newsletter_editions')
      .select('stats_delivered, stats_opens, stats_clicks')
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .gte('sent_at', start.toISOString())
      .lte('sent_at', end.toISOString()),
    supabase
      .from('content_events')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('event_type', 'link_click')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString()),
  ])

  const rows = currentMetricsRes.data ?? []
  const subCount = subCountRes.count
  const editionsData = editionsRes.data ?? []
  const linkClickCount = linkClickRes.count
  const totalViews = rows.reduce((s, r) => s + (r.views ?? 0), 0)
  const totalUnique = rows.reduce((s, r) => s + (r.unique_views ?? 0), 0)
  const totalReads = rows.reduce((s, r) => s + (r.reads_complete ?? 0), 0)

  const totalDelivered = editionsData.reduce((s, e) => s + (e.stats_delivered ?? 0), 0)
  const totalOpens = editionsData.reduce((s, e) => s + (e.stats_opens ?? 0), 0)
  const openRate = totalDelivered > 0 ? Math.round((totalOpens / totalDelivered) * 100) : 0

  // Sparkline: last N days
  const sparklineMap = new Map<string, number>()
  for (const r of rows) {
    sparklineMap.set(r.date, (sparklineMap.get(r.date) ?? 0) + r.views)
  }
  const sparklineDays = Math.min(days, 14)
  const viewsSparkline: number[] = []
  for (let i = sparklineDays - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    const key = toDateStringInTz(d, timezone)
    viewsSparkline.push(sparklineMap.get(key) ?? 0)
  }

  // Previous period
  let prevViews: number | null = null
  let prevUnique: number | null = null
  let prevReads: number | null = null
  let prevSubs: number | null = null
  let prevOpenRate: number | null = null
  let prevLinkClicks: number | null = null

  if (prevRange) {
    const [prevMetricsRes, prevEditionsRes, prevLinkCountRes] = await Promise.all([
      supabase
        .from('content_metrics')
        .select('views, unique_views, reads_complete')
        .eq('site_id', siteId)
        .gte('date', toDateStringInTz(prevRange.start, timezone))
        .lte('date', toDateStringInTz(prevRange.end, timezone)),
      supabase
        .from('newsletter_editions')
        .select('stats_delivered, stats_opens')
        .eq('site_id', siteId)
        .eq('status', 'sent')
        .gte('sent_at', prevRange.start.toISOString())
        .lte('sent_at', prevRange.end.toISOString()),
      supabase
        .from('content_events')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .eq('event_type', 'link_click')
        .gte('created_at', prevRange.start.toISOString())
        .lte('created_at', prevRange.end.toISOString()),
    ])

    const pRows = prevMetricsRes.data ?? []
    prevViews = pRows.reduce((s, r) => s + (r.views ?? 0), 0)
    prevUnique = pRows.reduce((s, r) => s + (r.unique_views ?? 0), 0)
    prevReads = pRows.reduce((s, r) => s + (r.reads_complete ?? 0), 0)
    prevSubs = 0 // subscribers is cumulative, no period comparison

    const pEd = prevEditionsRes.data ?? []
    const pDelivered = pEd.reduce((s, e) => s + (e.stats_delivered ?? 0), 0)
    const pOpens = pEd.reduce((s, e) => s + (e.stats_opens ?? 0), 0)
    prevOpenRate = pDelivered > 0 ? Math.round((pOpens / pDelivered) * 100) : 0

    prevLinkClicks = prevLinkCountRes.count ?? 0
  }

  return [
    { label: 'Views', value: totalViews, previousValue: prevViews, sparkline: viewsSparkline },
    { label: 'Unique Visitors', value: totalUnique, previousValue: prevUnique, sparkline: [] },
    { label: 'Reads Complete', value: totalReads, previousValue: prevReads, sparkline: [] },
    { label: 'Subscribers', value: subCount ?? 0, previousValue: prevSubs, sparkline: [] },
    { label: 'Open Rate', value: openRate, previousValue: prevOpenRate, sparkline: [] },
    { label: 'Link Clicks', value: linkClickCount ?? 0, previousValue: prevLinkClicks, sparkline: [] },
  ]
}

/* ------------------------------------------------------------------ */
/*  Funnel Data                                                       */
/* ------------------------------------------------------------------ */

export async function fetchFunnelData(
  siteId: string,
  period: PeriodInput,
  timezone: string,
): Promise<FunnelData> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  // All funnel queries are independent — run in parallel
  const [metricsRes, read50Res, clickedLinkRes, editionsRes, subscribedRes] = await Promise.all([
    supabase
      .from('content_metrics')
      .select('views, reads_complete')
      .eq('site_id', siteId)
      .gte('date', toDateStringInTz(start, timezone))
      .lte('date', toDateStringInTz(end, timezone)),
    supabase
      .from('content_events')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .in('event_type', ['read_progress', 'read_complete'])
      .gte('read_depth', 50)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString()),
    supabase
      .from('content_events')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('event_type', 'link_click')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString()),
    supabase
      .from('newsletter_editions')
      .select('stats_opens')
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .gte('sent_at', start.toISOString())
      .lte('sent_at', end.toISOString()),
    supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'confirmed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString()),
  ])

  const metricsRows = metricsRes.data ?? []
  const views = metricsRows.reduce((s, r) => s + (r.views ?? 0), 0)
  const readsComplete = metricsRows.reduce((s, r) => s + (r.reads_complete ?? 0), 0)
  const nlOpened = (editionsRes.data ?? []).reduce((s, e) => s + (e.stats_opens ?? 0), 0)

  return {
    views,
    read50: read50Res.count ?? readsComplete,
    clickedLink: clickedLinkRes.count ?? 0,
    nlOpened,
    subscribed: subscribedRes.count ?? 0,
  }
}

/* ------------------------------------------------------------------ */
/*  Top Links                                                         */
/* ------------------------------------------------------------------ */

export async function fetchTopLinks(
  siteId: string,
  period: PeriodInput,
  siteOrigin: string,
): Promise<ClickedLink[]> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  const { data: events } = await supabase
    .from('content_events')
    .select('dest_url, referrer_src')
    .eq('site_id', siteId)
    .eq('event_type', 'link_click')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .not('dest_url', 'is', null)
    .limit(500)

  if (!events || events.length === 0) return []

  // Aggregate by dest_url
  const byUrl = new Map<string, { clicks: number; sources: Map<string, number> }>()
  for (const e of events) {
    const url = e.dest_url as string
    const existing = byUrl.get(url) ?? { clicks: 0, sources: new Map() }
    existing.clicks++
    const src = (e.referrer_src as string) ?? 'other'
    existing.sources.set(src, (existing.sources.get(src) ?? 0) + 1)
    byUrl.set(url, existing)
  }

  // Sort and take top 10
  const sorted = Array.from(byUrl.entries())
    .sort((a, b) => b[1].clicks - a[1].clicks)
    .slice(0, 10)

  return sorted.map(([url, data]) => {
    // Find top source
    let topSource = 'other'
    let topCount = 0
    for (const [src, count] of data.sources) {
      if (count > topCount) {
        topSource = src
        topCount = count
      }
    }

    return {
      url,
      linkType: classifyLink(url, siteOrigin),
      clicks: data.clicks,
      topSource,
    }
  })
}

/* ------------------------------------------------------------------ */
/*  Clicks Destination breakdown                                      */
/* ------------------------------------------------------------------ */

export async function fetchClicksDestination(
  siteId: string,
  period: PeriodInput,
  siteOrigin: string,
): Promise<ClicksDestination> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  const { data: events } = await supabase
    .from('content_events')
    .select('dest_url')
    .eq('site_id', siteId)
    .eq('event_type', 'link_click')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .not('dest_url', 'is', null)
    .limit(1000)

  const result: ClicksDestination = { inHouse: 0, external: 0, youtube: 0, affiliate: 0 }
  if (!events) return result

  for (const e of events) {
    const url = e.dest_url as string
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      result.youtube++
    } else if (url.includes('/go/') || url.includes('?ref=') || url.includes('&tag=')) {
      result.affiliate++
    } else {
      const type = classifyLink(url, siteOrigin)
      if (type === 'internal' || type === 'shortlink') {
        result.inHouse++
      } else {
        result.external++
      }
    }
  }

  return result
}

/* ------------------------------------------------------------------ */
/*  Clicks Source breakdown                                           */
/* ------------------------------------------------------------------ */

export async function fetchClicksSource(
  siteId: string,
  period: PeriodInput,
): Promise<ClicksSource> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  const { data: events } = await supabase
    .from('content_events')
    .select('referrer_src')
    .eq('site_id', siteId)
    .eq('event_type', 'link_click')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .limit(1000)

  const result: ClicksSource = { blog: 0, newsletter: 0, video: 0, social: 0, other: 0 }
  if (!events) return result

  for (const e of events) {
    const src = (e.referrer_src as string) ?? 'other'
    switch (src) {
      case 'direct':
      case 'google':
        result.blog++
        break
      case 'newsletter':
        result.newsletter++
        break
      case 'social':
        result.social++
        break
      default:
        result.other++
        break
    }
  }

  return result
}

/* ------------------------------------------------------------------ */
/*  Clicks Chart                                                      */
/* ------------------------------------------------------------------ */

export async function fetchClicksChart(
  siteId: string,
  period: PeriodInput,
  timezone: string,
): Promise<ClicksChartPoint[]> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)
  const prevRange = resolvePrevDateRange(period)
  const days = getDaysBetween(start, end)

  // Current period daily link clicks
  const { data: currentEvents } = await supabase
    .from('content_events')
    .select('created_at')
    .eq('site_id', siteId)
    .eq('event_type', 'link_click')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .limit(5000)

  // Count by date
  const currentByDate = new Map<string, number>()
  for (const e of currentEvents ?? []) {
    const date = toDateStringInTz(new Date(e.created_at as string), timezone)
    currentByDate.set(date, (currentByDate.get(date) ?? 0) + 1)
  }

  // Previous period
  const prevByDate = new Map<string, number>()
  if (prevRange) {
    const { data: prevEvents } = await supabase
      .from('content_events')
      .select('created_at')
      .eq('site_id', siteId)
      .eq('event_type', 'link_click')
      .gte('created_at', prevRange.start.toISOString())
      .lte('created_at', prevRange.end.toISOString())
      .limit(5000)

    for (const e of prevEvents ?? []) {
      const date = toDateStringInTz(new Date(e.created_at as string), timezone)
      prevByDate.set(date, (prevByDate.get(date) ?? 0) + 1)
    }
  }

  // Build chart points
  const points: ClicksChartPoint[] = []
  const totalCurrent = Array.from(currentByDate.values()).reduce((s, v) => s + v, 0)
  const average = days > 0 ? Math.round(totalCurrent / days) : 0

  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = toDateStringInTz(d, timezone)

    // Find corresponding previous date
    let prevValue = 0
    if (prevRange) {
      const prevD = new Date(prevRange.start)
      prevD.setDate(prevD.getDate() + i)
      const prevDateStr = toDateStringInTz(prevD, timezone)
      prevValue = prevByDate.get(prevDateStr) ?? 0
    }

    points.push({
      date: dateStr,
      current: currentByDate.get(dateStr) ?? 0,
      previous: prevValue,
      average,
    })
  }

  return points
}
