import 'server-only'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { PeriodInput } from '@/app/cms/(authed)/analytics/types'

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

function resolveDateRange(period: PeriodInput): { start: Date; end: Date } {
  const end = new Date()
  if (period.type === 'custom') return { start: new Date(period.start), end: new Date(period.end) }
  const days = period.value === '7d' ? 7 : period.value === '30d' ? 30 : period.value === '90d' ? 90 : 365
  const start = new Date()
  start.setDate(start.getDate() - days)
  return { start, end }
}

export async function fetchAudienceTabData(siteId: string, period: PeriodInput): Promise<AudienceTabData> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  const { data: countryRaw } = await supabase.rpc('get_audience_countries', {
    p_site_id: siteId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  })

  const countries: CountryBreakdown[] = (countryRaw ?? []).map((r: Record<string, unknown>) => ({
    country: r.country as string,
    percentage: Number(r.percentage ?? 0),
  }))

  const { data: deviceRaw } = await supabase.rpc('get_audience_devices', {
    p_site_id: siteId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  })

  const devices: DeviceBreakdown[] = (deviceRaw ?? []).map((r: Record<string, unknown>) => ({
    device: r.device_type as string,
    percentage: Number(r.percentage ?? 0),
  }))

  const { data: sourceRaw } = await supabase.rpc('get_audience_sources', {
    p_site_id: siteId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  })

  const sources: TrafficSource[] = (sourceRaw ?? []).map((r: Record<string, unknown>) => ({
    source: r.referrer_src as string,
    percentage: Number(r.percentage ?? 0),
  }))

  // Cross-system funnel — placeholder values until YT integration is wired
  const funnel: FunnelStep[] = [
    { label: 'YT Views', value: 0 },
    { label: 'Blog Clicks', value: 0, dropOff: '—' },
    { label: 'NL Signups', value: 0, dropOff: '—' },
    { label: 'Purchases', value: 0, dropOff: '—' },
  ]

  // Best time — no dedicated RPC, return empty (will be populated later)
  const bestTimes: BestTimeSlot[] = []

  return { countries, devices, sources, funnel, bestTimes }
}
