import 'server-only'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import type { PeriodInput } from '@/app/cms/(authed)/analytics/types'

export interface ContentKpi {
  label: string
  value: number | string
  delta: { value: string; direction: 'up' | 'down' | 'neutral' } | null
  sparkline: number[]
}

export interface TopPost {
  id: string
  title: string
  status: string
  views: number
  uniqueViews: number
  avgDepth: number
  avgTime: number
  readsComplete: number
}

export interface DailyViewPoint {
  date: string
  current: number
  previous: number
}

export interface ContentTabData {
  kpis: ContentKpi[]
  topPosts: TopPost[]
  dailyChart: DailyViewPoint[]
}

function resolveDateRange(period: PeriodInput): { start: Date; end: Date } {
  const end = new Date()
  if (period.type === 'custom') {
    return { start: new Date(period.start), end: new Date(period.end) }
  }
  const days = period.value === '7d' ? 7 : period.value === '30d' ? 30 : period.value === '90d' ? 90 : 365
  const start = new Date()
  start.setDate(start.getDate() - days)
  return { start, end }
}

function resolvePrevDateRange(period: PeriodInput): { start: Date; end: Date } | null {
  if (period.type === 'custom') return null
  if (period.value === 'all') return null
  const days = period.value === '7d' ? 7 : period.value === '30d' ? 30 : 90
  const end = new Date()
  end.setDate(end.getDate() - days)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { start, end }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function fetchContentTabData(
  siteId: string,
  period: PeriodInput,
  timezone: string,
): Promise<ContentTabData> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)
  const prevRange = resolvePrevDateRange(period)
  const startStr = toDateStringInTz(start, timezone)
  const endStr = toDateStringInTz(end, timezone)

  const { data: metrics } = await supabase
    .from('content_metrics')
    .select('date, views, unique_views, reads_complete, avg_read_depth, avg_time_sec')
    .eq('site_id', siteId)
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date', { ascending: true })

  const rows = metrics ?? []
  const totalReads = rows.reduce((s, r) => s + (r.reads_complete ?? 0), 0)
  const avgDepth =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r.avg_read_depth ?? 0), 0) / rows.length)
      : 0
  const avgTime =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r.avg_time_sec ?? 0), 0) / rows.length)
      : 0

  const { count: postsCount } = await supabase
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('status', 'published')
    .gte('published_at', start.toISOString())
    .lte('published_at', end.toISOString())

  let prevReads = 0
  let prevDepth = 0
  let prevTime = 0
  let prevPosts = 0

  if (prevRange) {
    const { data: prevMetrics } = await supabase
      .from('content_metrics')
      .select('views, reads_complete, avg_read_depth, avg_time_sec')
      .eq('site_id', siteId)
      .gte('date', toDateStringInTz(prevRange.start, timezone))
      .lte('date', toDateStringInTz(prevRange.end, timezone))

    const prev = prevMetrics ?? []
    prevReads = prev.reduce((s, r) => s + (r.reads_complete ?? 0), 0)
    prevDepth =
      prev.length > 0
        ? Math.round(prev.reduce((s, r) => s + (r.avg_read_depth ?? 0), 0) / prev.length)
        : 0
    prevTime =
      prev.length > 0
        ? Math.round(prev.reduce((s, r) => s + (r.avg_time_sec ?? 0), 0) / prev.length)
        : 0

    const { count } = await supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'published')
      .gte('published_at', prevRange.start.toISOString())
      .lte('published_at', prevRange.end.toISOString())
    prevPosts = count ?? 0
  }

  function makeDelta(current: number, previous: number, suffix = ''): ContentKpi['delta'] {
    if (!prevRange) return null
    const diff = current - previous
    if (diff === 0) return { value: '— same', direction: 'neutral' }
    const sign = diff > 0 ? '+' : ''
    return { value: `${sign}${diff}${suffix}`, direction: diff > 0 ? 'up' : 'down' }
  }

  const kpis: ContentKpi[] = [
    {
      label: 'Posts Published',
      value: postsCount ?? 0,
      delta: makeDelta(postsCount ?? 0, prevPosts),
      sparkline: rows.map(() => 1),
    },
    {
      label: 'Avg Read Depth',
      value: `${avgDepth}%`,
      delta: makeDelta(avgDepth, prevDepth, 'pp'),
      sparkline: rows.map((r) => r.avg_read_depth ?? 0),
    },
    {
      label: 'Avg Time on Page',
      value: formatDuration(avgTime),
      delta: makeDelta(avgTime, prevTime, 's'),
      sparkline: rows.map((r) => r.avg_time_sec ?? 0),
    },
    {
      label: 'Reads Complete',
      value: totalReads,
      delta: makeDelta(totalReads, prevReads),
      sparkline: rows.map((r) => r.reads_complete ?? 0),
    },
  ]

  const { data: topPostsRaw } = await supabase.rpc('get_top_posts_analytics', {
    p_site_id: siteId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_limit: 10,
  })

  const topPosts: TopPost[] = (topPostsRaw ?? []).map((r: Record<string, unknown>) => ({
    id: r['id'] as string,
    title: r['title'] as string,
    status: r['status'] as string,
    views: Number(r['views'] ?? 0),
    uniqueViews: Number(r['unique_views'] ?? 0),
    avgDepth: Number(r['avg_depth'] ?? 0),
    avgTime: Number(r['avg_time'] ?? 0),
    readsComplete: Number(r['reads_complete'] ?? 0),
  }))

  const dailyChart: DailyViewPoint[] = rows.map((r) => ({
    date: r.date,
    current: r.views ?? 0,
    previous: 0,
  }))

  if (prevRange) {
    const { data: prevDaily } = await supabase
      .from('content_metrics')
      .select('date, views')
      .eq('site_id', siteId)
      .gte('date', toDateStringInTz(prevRange.start, timezone))
      .lte('date', toDateStringInTz(prevRange.end, timezone))
      .order('date', { ascending: true })

    const prevArr = prevDaily ?? []
    for (let i = 0; i < dailyChart.length; i++) {
      dailyChart[i]!.previous = prevArr[i]?.views ?? 0
    }
  }

  return { kpis, topPosts, dailyChart }
}
