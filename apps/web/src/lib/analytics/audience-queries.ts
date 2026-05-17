import 'server-only'

import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { PeriodInput } from '@/app/cms/(authed)/analytics/types'
import { resolveDateRange } from './date-range'

export interface CountryBreakdown {
  country: string
  percentage: number
}

export interface DeviceBreakdown {
  device: string
  percentage: number
}

export interface TrafficSource {
  source: string
  percentage: number
}

export interface FunnelStep {
  label: string
  value: number
  dropOff?: string
}

export interface BestTimeSlot {
  channel: string
  color: string
  bestDay: string
  bestHour: string
  heatmap: number[][]
}

export interface AudienceTabData {
  countries: CountryBreakdown[]
  devices: DeviceBreakdown[]
  sources: TrafficSource[]
  funnel: FunnelStep[]
  bestTimes: BestTimeSlot[]
}


export function fetchAudienceTabData(siteId: string, period: PeriodInput): Promise<AudienceTabData> {
  const cacheKey = period.type === 'custom'
    ? `audience-tab-${siteId}-${period.start}-${period.end}`
    : `audience-tab-${siteId}-${period.value}`
  return unstable_cache(
    () => _fetchAudienceTabData(siteId, period),
    [cacheKey],
    { revalidate: 300, tags: ['analytics'] },
  )()
}

async function _fetchAudienceTabData(siteId: string, period: PeriodInput): Promise<AudienceTabData> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  // All queries in a single parallel batch
  const [countryRes, deviceRes, sourceRes, viewsRes, clicksRes, signupsRes] = await Promise.all([
    supabase.rpc('get_audience_countries', { p_site_id: siteId, p_start: start.toISOString(), p_end: end.toISOString() }),
    supabase.rpc('get_audience_devices', { p_site_id: siteId, p_start: start.toISOString(), p_end: end.toISOString() }),
    supabase.rpc('get_audience_sources', { p_site_id: siteId, p_start: start.toISOString(), p_end: end.toISOString() }),
    supabase.from('content_events').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('event_type', 'view').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
    supabase.from('link_clicks').select('id', { count: 'exact', head: true }).eq('site_id', siteId).gte('clicked_at', start.toISOString()).lte('clicked_at', end.toISOString()),
    supabase.from('newsletter_subscriptions').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'confirmed').gte('confirmed_at', start.toISOString()).lte('confirmed_at', end.toISOString()),
  ])

  const countries: CountryBreakdown[] = (countryRes.data ?? []).map((r: Record<string, unknown>) => ({
    country: r.country as string,
    percentage: Number(r.percentage ?? 0),
  }))

  const devices: DeviceBreakdown[] = (deviceRes.data ?? []).map((r: Record<string, unknown>) => ({
    device: r.device_type as string,
    percentage: Number(r.percentage ?? 0),
  }))

  const sources: TrafficSource[] = (sourceRes.data ?? []).map((r: Record<string, unknown>) => ({
    source: r.referrer_src as string,
    percentage: Number(r.percentage ?? 0),
  }))

  const funnelViews = viewsRes.count ?? 0
  const funnelClicks = clicksRes.count ?? 0
  const funnelSignups = signupsRes.count ?? 0

  function computeDropOff(from: number, to: number): string {
    if (from === 0) return '—'
    const drop = Math.round(((from - to) / from) * 100)
    return `-${drop}%`
  }

  const funnel: FunnelStep[] = [
    { label: 'Page Views', value: funnelViews },
    { label: 'Link Clicks', value: funnelClicks, dropOff: computeDropOff(funnelViews, funnelClicks) },
    { label: 'NL Signups', value: funnelSignups, dropOff: computeDropOff(funnelClicks, funnelSignups) },
    { label: 'Purchases', value: 0, dropOff: computeDropOff(funnelSignups, 0) },
  ]

  // Best time — no dedicated RPC, return empty (will be populated later)
  const bestTimes: BestTimeSlot[] = []

  return { countries, devices, sources, funnel, bestTimes }
}
