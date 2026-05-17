import 'server-only'

import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { PeriodInput } from '@/app/cms/(authed)/analytics/types'
import { resolveDateRange, resolvePrevDateRange } from './date-range'

export interface LinksKpi {
  label: string
  value: number | string
  delta: { value: string; direction: 'up' | 'down' | 'neutral' } | null
  sparkline: number[]
}

export interface LinkRow {
  id: string
  code: string
  source: string
  clicks: number
  uniqueClicks: number
  conversions: number
  topCountry: string
  topDevice: string
}

export interface ReferrerItem {
  domain: string
  clicks: number
}

export interface CampaignRow {
  campaign: string
  medium: string
  clicks: number
  conversions: number
  rate: number
}

export interface LinksTabData {
  kpis: LinksKpi[]
  links: LinkRow[]
  referrers: ReferrerItem[]
  campaigns: CampaignRow[]
}


export function fetchLinksTabData(siteId: string, period: PeriodInput): Promise<LinksTabData> {
  const cacheKey = period.type === 'custom'
    ? `links-tab-${siteId}-${period.start}-${period.end}`
    : `links-tab-${siteId}-${period.value}`
  return unstable_cache(
    () => _fetchLinksTabData(siteId, period),
    [cacheKey],
    { revalidate: 300, tags: ['analytics'] },
  )()
}

async function _fetchLinksTabData(siteId: string, period: PeriodInput): Promise<LinksTabData> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  // 7-day sparkline days (sync — no async needed)
  const sparklineDays: string[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    sparklineDays.push(new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10))
  }

  // Phase 1 — All independent queries in parallel
  const [totalClicksRes, activeLinksRes, topLinksRes, refRes, campRes, dailyClicksRes] = await Promise.all([
    supabase.from('link_clicks').select('id', { count: 'exact', head: true }).eq('site_id', siteId).gte('clicked_at', start.toISOString()).lte('clicked_at', end.toISOString()),
    supabase.from('tracked_links').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('active', true),
    supabase.rpc('get_top_links_analytics', { p_site_id: siteId, p_start: start.toISOString(), p_end: end.toISOString(), p_limit: 20 }),
    supabase.rpc('get_top_referrers', { p_site_id: siteId, p_start: start.toISOString(), p_end: end.toISOString(), p_limit: 5 }),
    supabase.rpc('get_utm_campaigns', { p_site_id: siteId, p_start: start.toISOString(), p_end: end.toISOString() }),
    supabase.from('link_daily_metrics').select('date, clicks').eq('site_id', siteId).gte('date', sparklineDays[0]),
  ])

  const totalClicks = totalClicksRes.count ?? 0
  const activeLinks = activeLinksRes.count ?? 0

  const links: LinkRow[] = (topLinksRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    code: r.code as string,
    source: (r.source as string) ?? 'direct',
    clicks: Number(r.clicks ?? 0),
    uniqueClicks: Number(r.unique_clicks ?? 0),
    conversions: Number(r.conversions ?? 0),
    topCountry: (r.top_country as string) ?? '—',
    topDevice: (r.top_device as string) ?? '—',
  }))

  const referrers: ReferrerItem[] = (refRes.data ?? []).map((r: Record<string, unknown>) => ({
    domain: r.domain as string,
    clicks: Number(r.clicks ?? 0),
  }))

  const campaigns: CampaignRow[] = (campRes.data ?? []).map((r: Record<string, unknown>) => ({
    campaign: r.campaign as string,
    medium: (r.medium as string) ?? 'direct',
    clicks: Number(r.clicks ?? 0),
    conversions: Number(r.conversions ?? 0),
    rate: Number(r.rate ?? 0),
  }))

  const totalConversions = links.reduce((s, l) => s + l.conversions, 0)
  const convRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0'

  // Phase 2 — Conditional previous period (only if prevRange exists)
  const prevRange = resolvePrevDateRange(period)
  let prevClicks = 0
  if (prevRange) {
    const { count } = await supabase
      .from('link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .gte('clicked_at', prevRange.start.toISOString())
      .lte('clicked_at', prevRange.end.toISOString())
    prevClicks = count ?? 0
  }

  function makeDelta(current: number, previous: number): LinksKpi['delta'] {
    if (!prevRange) return null
    const diff = current - previous
    if (diff === 0) return { value: '— same', direction: 'neutral' }
    const sign = diff > 0 ? '+' : ''
    return { value: `${sign}${diff}`, direction: diff > 0 ? 'up' : 'down' }
  }

  const clicksByDay = new Map<string, number>()
  for (const r of (dailyClicksRes.data ?? []) as Array<{ date: string; clicks: number }>) {
    clicksByDay.set(r.date, (clicksByDay.get(r.date) ?? 0) + r.clicks)
  }
  const clicksSparkline = sparklineDays.map(d => clicksByDay.get(d) ?? 0)

  const kpis: LinksKpi[] = [
    { label: 'Total Clicks', value: totalClicks, delta: makeDelta(totalClicks, prevClicks), sparkline: clicksSparkline },
    { label: 'Unique Clicks', value: links.reduce((s, l) => s + l.uniqueClicks, 0), delta: null, sparkline: [] },
    { label: 'Conversions', value: totalConversions, delta: null, sparkline: [] },
    { label: 'Conv. Rate', value: `${convRate}%`, delta: null, sparkline: [] },
    { label: 'Active Links', value: activeLinks, delta: null, sparkline: [] },
  ]

  return { kpis, links, referrers, campaigns }
}
