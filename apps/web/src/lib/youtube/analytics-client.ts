import 'server-only'

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

interface TokenInfo {
  accessToken: string
  channelId: string
}

async function getYouTubeToken(siteId: string): Promise<TokenInfo | null> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('social_connections')
    .select('account_id')
    .eq('site_id', siteId)
    .eq('provider', 'youtube')
    .is('revoked_at', null)
    .order('connected_at', { ascending: false })
    .limit(1)
    .single()

  if (!data?.account_id) return null

  const channelId = data.account_id as string

  // ensureFreshToken handles decrypt + automatic refresh if token is near-expiry
  const { accessToken } = await ensureFreshToken(siteId, 'youtube')

  return { accessToken, channelId }
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

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`YouTube Analytics API error ${res.status}: ${err}`)
  }

  return res.json() as Promise<YtAnalyticsReport>
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]!
}

export async function fetchYtChannelMetrics(
  siteId: string,
  days: number,
): Promise<YtChannelMetrics | null> {
  const tokenInfo = await getYouTubeToken(siteId)
  if (!tokenInfo) return null

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  const report = await queryYtAnalytics(tokenInfo.accessToken, tokenInfo.channelId, {
    startDate: toDateStr(start),
    endDate: toDateStr(end),
    metrics:
      'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,impressions,impressionClickThroughRate,likes,comments,shares',
  })

  if (!report.rows?.[0]) return null
  const row = report.rows[0]!

  return {
    views: Number(row[0]),
    estimatedMinutesWatched: Number(row[1]),
    averageViewDuration: Number(row[2]),
    averageViewPercentage: Number(row[3]),
    subscribersGained: Number(row[4]),
    subscribersLost: Number(row[5]),
    impressions: Number(row[6]),
    impressionClickThroughRate: Number(row[7]),
    likes: Number(row[8]),
    comments: Number(row[9]),
    shares: Number(row[10]),
  }
}

export async function fetchYtDailyMetrics(siteId: string, days: number): Promise<YtDailyMetric[]> {
  const tokenInfo = await getYouTubeToken(siteId)
  if (!tokenInfo) return []

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  const report = await queryYtAnalytics(tokenInfo.accessToken, tokenInfo.channelId, {
    startDate: toDateStr(start),
    endDate: toDateStr(end),
    metrics:
      'views,estimatedMinutesWatched,subscribersGained,subscribersLost,impressions,impressionClickThroughRate,likes,comments,shares',
    dimensions: 'day',
    sort: 'day',
  })

  return (report.rows ?? []).map((row) => ({
    date: String(row[0]),
    views: Number(row[1]),
    estimatedMinutesWatched: Number(row[2]),
    subscribersGained: Number(row[3]),
    subscribersLost: Number(row[4]),
    impressions: Number(row[5]),
    impressionClickThroughRate: Number(row[6]),
    likes: Number(row[7]),
    comments: Number(row[8]),
    shares: Number(row[9]),
  }))
}

export async function fetchYtSearchTerms(siteId: string, days: number): Promise<YtSearchTerm[]> {
  const tokenInfo = await getYouTubeToken(siteId)
  if (!tokenInfo) return []

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  const report = await queryYtAnalytics(tokenInfo.accessToken, tokenInfo.channelId, {
    startDate: toDateStr(start),
    endDate: toDateStr(end),
    metrics: 'views,estimatedMinutesWatched,impressionClickThroughRate',
    dimensions: 'insightTrafficSourceDetail',
    filters: 'insightTrafficSourceType==YT_SEARCH',
    sort: '-views',
    maxResults: 25,
  })

  return (report.rows ?? []).map((row) => ({
    term: String(row[0]),
    views: Number(row[1]),
    estimatedMinutesWatched: Number(row[2]),
    impressionClickThroughRate: Number(row[3]),
  }))
}

export async function fetchYtDemographics(siteId: string, days: number): Promise<YtDemographics> {
  const tokenInfo = await getYouTubeToken(siteId)
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
