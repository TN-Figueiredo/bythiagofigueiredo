import 'server-only'

import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import type {
  YtAnalyticsReport,
  YtChannelMetrics,
  YtDailyMetric,
  YtSearchTerm,
  YtDemographics,
} from './analytics-types'

const YT_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2/reports'

export class YouTubeAnalyticsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly channelId: string,
    public readonly errorBody?: string,
  ) {
    super(message)
    this.name = 'YouTubeAnalyticsError'
  }
}

async function fetchWithRetry(
  url: string,
  headers: HeadersInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers, next: { revalidate: 300 } })
    if (res.ok) return res
    if (res.status < 500 && res.status !== 429) return res
    lastError = new Error(`HTTP ${res.status}`)
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  throw lastError!
}

interface TokenInfo {
  accessToken: string
  channelId: string
}

async function getYouTubeToken(siteId: string, targetChannelId?: string): Promise<TokenInfo | null> {
  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('social_connections')
    .select('account_id')
    .eq('site_id', siteId)
    .eq('provider', 'youtube')
    .is('revoked_at', null)
  if (targetChannelId) query = query.eq('account_id', targetChannelId)
  const { data } = await query
    .order('connected_at', { ascending: false })
    .limit(1)
    .single()

  if (!data?.account_id) return null

  const channelId = data.account_id as string
  const { accessToken } = await ensureFreshToken(siteId, 'youtube', channelId)

  return { accessToken, channelId }
}

export interface YtConnectedChannel {
  internalId: string
  channelId: string
  name: string
  handle: string
  thumbnailUrl: string | null
}

export async function getConnectedYouTubeChannels(siteId: string): Promise<YtConnectedChannel[]> {
  const supabase = getSupabaseServiceClient()

  const { data: connections } = await supabase
    .from('social_connections')
    .select('account_id')
    .eq('site_id', siteId)
    .eq('provider', 'youtube')
    .is('revoked_at', null)

  if (!connections || connections.length === 0) return []

  const connectedIds = connections.map(c => c.account_id as string)

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, channel_id, name, handle, thumbnail_url')
    .eq('site_id', siteId)
    .in('channel_id', connectedIds)
    .order('name')

  return (channels ?? []).map(ch => ({
    internalId: ch.id as string,
    channelId: ch.channel_id as string,
    name: ch.name as string,
    handle: ch.handle as string,
    thumbnailUrl: ch.thumbnail_url as string | null,
  }))
}

async function queryYtAnalytics(
  token: string,
  channelId: string,
  params: {
    startDate: string
    endDate: string
    metrics: string
    dimensions?: string
    filters?: string
    sort?: string
    maxResults?: number
  },
): Promise<YtAnalyticsReport> {
  const url = new URL(YT_ANALYTICS_BASE)
  url.searchParams.set('ids', `channel==${channelId}`)
  url.searchParams.set('startDate', params.startDate)
  url.searchParams.set('endDate', params.endDate)
  url.searchParams.set('metrics', params.metrics)
  if (params.dimensions) url.searchParams.set('dimensions', params.dimensions)
  if (params.filters) url.searchParams.set('filters', params.filters)
  if (params.sort) url.searchParams.set('sort', params.sort)
  if (params.maxResults) url.searchParams.set('maxResults', String(params.maxResults))

  const res = await fetchWithRetry(url.toString(), { Authorization: `Bearer ${token}` })

  if (!res.ok) {
    const errorBody = await res.text()
    const endpoint = params.dimensions ?? params.metrics.split(',')[0] ?? 'unknown'
    throw new YouTubeAnalyticsError(
      `YouTube Analytics API error ${res.status}: ${errorBody}`,
      res.status,
      endpoint,
      channelId,
      errorBody,
    )
  }

  return res.json() as Promise<YtAnalyticsReport>
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]!
}

export async function fetchYtChannelMetrics(
  siteId: string,
  days: number,
  channelId?: string,
): Promise<YtChannelMetrics | null> {
  const tokenInfo = await getYouTubeToken(siteId, channelId)
  if (!tokenInfo) return null

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  // Core metrics available in the YouTube Analytics Reporting API.
  // NOTE: "impressions" and "impressionClickThroughRate" are YouTube Studio
  // metrics (Data API) — NOT available via the Analytics Reporting API.
  // Requesting them causes HTTP 400 "Unknown identifier".
  const coreMetrics = 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares'

  const coreReport = await queryYtAnalytics(tokenInfo.accessToken, tokenInfo.channelId, {
    startDate: toDateStr(start),
    endDate: toDateStr(end),
    metrics: coreMetrics,
  })

  if (!coreReport.rows?.[0]) return null
  const row = coreReport.rows[0]!

  return {
    views: Number(row[0]),
    estimatedMinutesWatched: Number(row[1]),
    averageViewDuration: Number(row[2]),
    averageViewPercentage: Number(row[3]),
    subscribersGained: Number(row[4]),
    subscribersLost: Number(row[5]),
    impressions: 0,
    impressionClickThroughRate: 0,
    likes: Number(row[6]),
    comments: Number(row[7]),
    shares: Number(row[8]),
  }
}

export async function fetchYtDailyMetrics(siteId: string, days: number, channelId?: string): Promise<YtDailyMetric[]> {
  const tokenInfo = await getYouTubeToken(siteId, channelId)
  if (!tokenInfo) return []

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  // NOTE: "impressions" and "impressionClickThroughRate" are NOT available
  // via the YouTube Analytics Reporting API — requesting them causes HTTP 400.
  const coreReport = await queryYtAnalytics(tokenInfo.accessToken, tokenInfo.channelId, {
    startDate: toDateStr(start),
    endDate: toDateStr(end),
    metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,comments,shares',
    dimensions: 'day',
    sort: 'day',
  })

  return (coreReport.rows ?? []).map((row) => ({
    date: String(row[0]),
    views: Number(row[1]) || 0,
    estimatedMinutesWatched: Number(row[2]) || 0,
    subscribersGained: Number(row[3]) || 0,
    subscribersLost: Number(row[4]) || 0,
    likes: Number(row[5]) || 0,
    comments: Number(row[6]) || 0,
    shares: Number(row[7]) || 0,
    impressions: 0,
    impressionClickThroughRate: 0,
  }))
}

export async function fetchYtSearchTerms(siteId: string, days: number, channelId?: string): Promise<YtSearchTerm[]> {
  const tokenInfo = await getYouTubeToken(siteId, channelId)
  if (!tokenInfo) return []

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  const report = await queryYtAnalytics(tokenInfo.accessToken, tokenInfo.channelId, {
    startDate: toDateStr(start),
    endDate: toDateStr(end),
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'insightTrafficSourceDetail',
    filters: 'insightTrafficSourceType==YT_SEARCH',
    sort: '-views',
    maxResults: 25,
  })

  return (report.rows ?? []).map((row) => ({
    term: String(row[0]),
    views: Number(row[1]),
    estimatedMinutesWatched: Number(row[2]),
  }))
}

export async function fetchYtDemographics(siteId: string, days: number, channelId?: string): Promise<YtDemographics> {
  const tokenInfo = await getYouTubeToken(siteId, channelId)
  if (!tokenInfo) return { ageGender: [], countries: [], devices: [] }

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  const [ageReport, countryReport, deviceReport] = await Promise.all([
    queryYtAnalytics(tokenInfo.accessToken, tokenInfo.channelId, {
      startDate: toDateStr(start),
      endDate: toDateStr(end),
      metrics: 'viewerPercentage',
      dimensions: 'ageGroup,gender',
    }),
    queryYtAnalytics(tokenInfo.accessToken, tokenInfo.channelId, {
      startDate: toDateStr(start),
      endDate: toDateStr(end),
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'country',
      sort: '-views',
      maxResults: 10,
    }),
    queryYtAnalytics(tokenInfo.accessToken, tokenInfo.channelId, {
      startDate: toDateStr(start),
      endDate: toDateStr(end),
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'deviceType',
      sort: '-views',
    }),
  ])

  const ageMap = new Map<string, { male: number; female: number }>()
  for (const row of ageReport.rows ?? []) {
    const group = String(row[0])
    const gender = String(row[1])
    const pct = Number(row[2])
    const entry = ageMap.get(group) ?? { male: 0, female: 0 }
    if (gender === 'male') entry.male = pct
    else entry.female = pct
    ageMap.set(group, entry)
  }
  const ageGender = Array.from(ageMap.entries()).map(([ageGroup, v]) => ({ ageGroup, ...v }))

  const totalCountryViews = (countryReport.rows ?? []).reduce((s, r) => s + Number(r[1]), 0)
  const countries = (countryReport.rows ?? []).map((row) => ({
    country: String(row[0]),
    views: Number(row[1]),
    percentage:
      totalCountryViews > 0 ? Math.round((Number(row[1]) / totalCountryViews) * 100) : 0,
  }))

  const totalDeviceViews = (deviceReport.rows ?? []).reduce((s, r) => s + Number(r[1]), 0)
  const devices = (deviceReport.rows ?? []).map((row) => ({
    deviceType: String(row[0]),
    views: Number(row[1]),
    percentage: totalDeviceViews > 0 ? Math.round((Number(row[1]) / totalDeviceViews) * 100) : 0,
  }))

  return { ageGender, countries, devices }
}
