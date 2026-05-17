import 'server-only'

import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import type { PeriodInput } from '@/app/cms/(authed)/analytics/types'
import { resolveDateRange, resolvePrevDateRange } from './date-range'

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


export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fetchContentTabData(
  siteId: string,
  period: PeriodInput,
  timezone: string,
): Promise<ContentTabData> {
  const cacheKey = period.type === 'custom'
    ? `content-tab-${siteId}-${period.start}-${period.end}`
    : `content-tab-${siteId}-${period.value}`
  return unstable_cache(
    () => _fetchContentTabData(siteId, period, timezone),
    [cacheKey],
    { revalidate: 300, tags: ['analytics'] },
  )()
}

async function _fetchContentTabData(
  siteId: string,
  period: PeriodInput,
  timezone: string,
): Promise<ContentTabData> {
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)
  const prevRange = resolvePrevDateRange(period)
  const startStr = toDateStringInTz(start, timezone)
  const endStr = toDateStringInTz(end, timezone)

  // Phase 1: All independent current-period queries in parallel
  const [metricsRes, postsCountRes, topPostsRes] = await Promise.all([
    supabase
      .from('content_metrics')
      .select('date, views, unique_views, reads_complete, avg_read_depth, avg_time_sec')
      .eq('site_id', siteId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true }),
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'published')
      .gte('published_at', start.toISOString())
      .lte('published_at', end.toISOString()),
    supabase.rpc('get_top_posts_analytics', {
      p_site_id: siteId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_limit: 10,
    }),
  ])

  const rows = metricsRes.data ?? []
  const postsCount = postsCountRes.count ?? 0
  const topPostsRaw = topPostsRes.data ?? []

  const totalReads = rows.reduce((s, r) => s + (r.reads_complete ?? 0), 0)
  const avgDepth =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r.avg_read_depth ?? 0), 0) / rows.length)
      : 0
  const avgTime =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r.avg_time_sec ?? 0), 0) / rows.length)
      : 0

  // Phase 2: Conditional previous-period queries in parallel
  let prevReads = 0
  let prevDepth = 0
  let prevTime = 0
  let prevPosts = 0
  let prevArr: Array<{ date: string; views: number }> = []

  if (prevRange) {
    const [prevMetricsRes, prevPostsRes, prevDailyRes] = await Promise.all([
      supabase
        .from('content_metrics')
        .select('views, reads_complete, avg_read_depth, avg_time_sec')
        .eq('site_id', siteId)
        .gte('date', toDateStringInTz(prevRange.start, timezone))
        .lte('date', toDateStringInTz(prevRange.end, timezone)),
      supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .eq('status', 'published')
        .gte('published_at', prevRange.start.toISOString())
        .lte('published_at', prevRange.end.toISOString()),
      supabase
        .from('content_metrics')
        .select('date, views')
        .eq('site_id', siteId)
        .gte('date', toDateStringInTz(prevRange.start, timezone))
        .lte('date', toDateStringInTz(prevRange.end, timezone))
        .order('date', { ascending: true }),
    ])

    const prev = prevMetricsRes.data ?? []
    prevReads = prev.reduce((s, r) => s + (r.reads_complete ?? 0), 0)
    prevDepth =
      prev.length > 0
        ? Math.round(prev.reduce((s, r) => s + (r.avg_read_depth ?? 0), 0) / prev.length)
        : 0
    prevTime =
      prev.length > 0
        ? Math.round(prev.reduce((s, r) => s + (r.avg_time_sec ?? 0), 0) / prev.length)
        : 0
    prevPosts = prevPostsRes.count ?? 0
    prevArr = (prevDailyRes.data ?? []) as Array<{ date: string; views: number }>
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
      value: postsCount,
      delta: makeDelta(postsCount, prevPosts),
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

  const topPosts: TopPost[] = (topPostsRaw).map((r: Record<string, unknown>) => ({
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

  for (let i = 0; i < dailyChart.length; i++) {
    dailyChart[i]!.previous = prevArr[i]?.views ?? 0
  }

  return { kpis, topPosts, dailyChart }
}
