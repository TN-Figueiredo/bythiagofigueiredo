import 'server-only'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { PeriodInput } from '@/app/cms/(authed)/analytics/types'

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

function resolveDateRange(period: PeriodInput): { start: Date; end: Date } {
  const end = new Date()
  if (period.type === 'custom') return { start: new Date(period.start), end: new Date(period.end) }
  const days = period.value === '7d' ? 7 : period.value === '30d' ? 30 : period.value === '90d' ? 90 : 365
  const start = new Date()
  start.setDate(start.getDate() - days)
  return { start, end }
}

export async function fetchLinksTabData(siteId: string, period: PeriodInput): Promise<LinksTabData> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  const { count: totalClicks } = await supabase
    .from('link_clicks')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .gte('clicked_at', start.toISOString())
    .lte('clicked_at', end.toISOString())

  const { count: activeLinks } = await supabase
    .from('tracked_links')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('is_active', true)

  const { data: topLinksRaw } = await supabase.rpc('get_top_links_analytics', {
    p_site_id: siteId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_limit: 20,
  })

  const links: LinkRow[] = (topLinksRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    code: r.code as string,
    source: (r.source as string) ?? 'direct',
    clicks: Number(r.clicks ?? 0),
    uniqueClicks: Number(r.unique_clicks ?? 0),
    conversions: Number(r.conversions ?? 0),
    topCountry: (r.top_country as string) ?? '—',
    topDevice: (r.top_device as string) ?? '—',
  }))

  const { data: refRaw } = await supabase.rpc('get_top_referrers', {
    p_site_id: siteId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_limit: 5,
  })

  const referrers: ReferrerItem[] = (refRaw ?? []).map((r: Record<string, unknown>) => ({
    domain: r.domain as string,
    clicks: Number(r.clicks ?? 0),
  }))

  const { data: campRaw } = await supabase.rpc('get_utm_campaigns', {
    p_site_id: siteId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  })

  const campaigns: CampaignRow[] = (campRaw ?? []).map((r: Record<string, unknown>) => ({
    campaign: r.campaign as string,
    medium: (r.medium as string) ?? 'direct',
    clicks: Number(r.clicks ?? 0),
    conversions: Number(r.conversions ?? 0),
    rate: Number(r.rate ?? 0),
  }))

  const totalConversions = links.reduce((s, l) => s + l.conversions, 0)
  const convRate = (totalClicks ?? 0) > 0 ? ((totalConversions / (totalClicks ?? 1)) * 100).toFixed(1) : '0'

  const kpis: LinksKpi[] = [
    { label: 'Total Clicks', value: totalClicks ?? 0, delta: null, sparkline: [] },
    { label: 'Unique Clicks', value: links.reduce((s, l) => s + l.uniqueClicks, 0), delta: null, sparkline: [] },
    { label: 'Conversions', value: totalConversions, delta: null, sparkline: [] },
    { label: 'Conv. Rate', value: `${convRate}%`, delta: null, sparkline: [] },
    { label: 'Active Links', value: activeLinks ?? 0, delta: null, sparkline: [] },
  ]

  return { kpis, links, referrers, campaigns }
}
