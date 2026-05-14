import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { DashboardKpis, DashboardActivity } from '@tn-figueiredo/links-admin'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import { LinksHub } from './_hub'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function LinksDashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId, timezone } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = toDateStringInTz(sevenDaysAgo, timezone)

  const [totalRes, activeRes, clicksRes, dailyRes, sourceRes] = await Promise.all([
    supabase
      .from('tracked_links')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .is('deleted_at', null),
    supabase
      .from('tracked_links')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('active', true)
      .is('deleted_at', null),
    supabase
      .from('tracked_links')
      .select('code, total_clicks')
      .eq('site_id', siteId)
      .is('deleted_at', null)
      .order('total_clicks', { ascending: false })
      .limit(1),
    supabase
      .from('link_daily_metrics')
      .select('date, weekday, clicks, unique_visitors, hourly_clicks')
      .eq('site_id', siteId)
      .gte('date', sevenDaysAgoStr)
      .order('date', { ascending: true }),
    supabase
      .from('tracked_links')
      .select('source_type, total_clicks')
      .eq('site_id', siteId)
      .is('deleted_at', null),
  ])

  const totalLinks = totalRes.count ?? 0
  const activeLinks = activeRes.count ?? 0
  const topRow = clicksRes.data?.[0]
  const totalClicks = topRow ? (topRow.total_clicks as number) ?? 0 : 0

  const metrics: DashboardKpis = {
    totalLinks,
    activeLinks,
    totalClicks,
    topPerformer: topRow
      ? { code: topRow.code as string, clicks: (topRow.total_clicks as number) ?? 0 }
      : null,
  }

  // Build daily clicks (aggregate across all links per day)
  const dailyMap = new Map<string, { clicks: number; unique: number }>()
  for (const row of dailyRes.data ?? []) {
    const d = row.date as string
    const prev = dailyMap.get(d) ?? { clicks: 0, unique: 0 }
    dailyMap.set(d, {
      clicks: prev.clicks + ((row.clicks as number) ?? 0),
      unique: prev.unique + ((row.unique_visitors as number) ?? 0),
    })
  }
  const dailyClicks = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    clicks: v.clicks,
    unique: v.unique,
  }))

  // Build hourly heatmap (7 days × 24 hours, Mon=0..Sun=6)
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const row of dailyRes.data ?? []) {
    const weekday = (row.weekday as number) ?? 0 // 0=Mon..6=Sun
    const hourly = row.hourly_clicks as Record<string, number> | null
    if (hourly && typeof hourly === 'object' && weekday >= 0 && weekday < 7) {
      for (const [h, count] of Object.entries(hourly)) {
        const hour = parseInt(h, 10)
        if (hour >= 0 && hour < 24) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- bounds checked above
          heatmap[weekday]![hour]! += typeof count === 'number' ? count : 0
        }
      }
    }
  }

  // Build source breakdown (aggregate total_clicks per source_type)
  const sourceMap = new Map<string, number>()
  for (const row of sourceRes.data ?? []) {
    const src = (row.source_type as string) ?? 'manual'
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + ((row.total_clicks as number) ?? 0))
  }
  const sourceBreakdown = Array.from(sourceMap.entries()).map(([source, clicks]) => ({
    source,
    clicks,
  }))

  const activity: DashboardActivity = {
    dailyClicks,
    hourlyHeatmap: heatmap,
    sourceBreakdown,
  }

  // Fetch paginated links (inline query — avoids server-action context issues)
  const page = parseInt(params.page ?? '1', 10)
  const perPage = 20
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let linksQuery = supabase
    .from('tracked_links')
    .select('*', { count: 'exact' })
    .eq('site_id', siteId)
    .is('deleted_at', null)

  if (params.search) {
    linksQuery = linksQuery.ilike('title', `%${params.search}%`)
  }
  if (params.source_type) {
    linksQuery = linksQuery.eq('source_type', params.source_type)
  }
  if (params.active !== undefined) {
    linksQuery = linksQuery.eq('active', params.active === 'true')
  }

  linksQuery = linksQuery.order('created_at', { ascending: false }).range(from, to)

  const { data: linksData } = await linksQuery
  const links = linksData ?? []

  return <LinksHub metrics={metrics} activity={activity} links={links} siteId={siteId} />
}
