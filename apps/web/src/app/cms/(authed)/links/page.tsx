import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { LinkDisplay, LinktreeDisplay, AnalyticsDisplay, SourceId } from '@tn-figueiredo/links-admin'
import { SOURCE_LABELS } from '@tn-figueiredo/links-admin'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import { LinksHub } from './_hub'
import type { TabId } from './_components/tab-bar'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

function toSourceId(s: string): SourceId {
  const valid: SourceId[] = ['newsletter', 'social', 'blog', 'qr', 'campaign', 'manual']
  return valid.includes(s as SourceId) ? (s as SourceId) : 'manual'
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

export default async function LinksDashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId, timezone } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const tab = (params.tab ?? 'tree') as TabId

  const supabase = getSupabaseServiceClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = toDateStringInTz(sevenDaysAgo, timezone)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const [linksRes, dailyRes, sourceRes, linktreeStatsRes, siteDataRes] = await Promise.all([
    supabase
      .from('tracked_links')
      .select('*')
      .eq('site_id', siteId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
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
    supabase
      .from('linktree_daily_metrics')
      .select('date, pageviews, unique_visitors, countries')
      .eq('site_id', siteId),
    supabase
      .from('sites')
      .select('short_domain, primary_domain, linktree_config')
      .eq('id', siteId)
      .single(),
  ])

  const rawLinks = linksRes.data ?? []
  const shortDomain = siteDataRes?.data?.short_domain ?? siteDataRes?.data?.primary_domain ?? ''

  // Build LinkDisplay[]
  const links: LinkDisplay[] = rawLinks.map((l) => ({
    id: l.id as string,
    title: (l.title as string) ?? (l.code as string),
    slug: `/${l.code as string}`,
    source: toSourceId((l.source_type as string) ?? 'manual'),
    badge: SOURCE_LABELS[toSourceId((l.source_type as string) ?? 'manual')],
    dest: (l.destination_url as string) ?? '',
    status: (l.active as boolean)
      ? 'active'
      : ((l.expires_at && new Date(l.expires_at as string) < new Date()) ? 'expired' : 'paused'),
    clicks: (l.total_clicks as number) ?? 0,
    last30: 0,
    unique: (l.unique_visitors as number) ?? 0,
    scans: 0,
    topCountry: 'BR',
    ctr: 0,
    created: fmtDate((l.created_at as string) ?? ''),
    health: ((l.health_status as string) === 'broken' ? 'broken' : (l.health_status as string) === 'warn' ? 'warn' : 'ok') as 'ok' | 'warn' | 'broken',
    redirect: ((l.redirect_type as number) === 302 ? 302 : 301) as 301 | 302,
    clickIds: (l.pass_click_ids as boolean) ?? false,
    spark: Array.from({ length: 14 }, () => 0),
  }))

  // Build LinktreeDisplay
  const ltStats = linktreeStatsRes?.data ?? []
  const ltTotalViews = ltStats.reduce((s, d) => s + ((d.pageviews as number) ?? 0), 0)
  const ltUniqueVisitors = ltStats.reduce((s, d) => s + ((d.unique_visitors as number) ?? 0), 0)
  const lt30dViews = ltStats
    .filter((d) => (d.date as string) >= thirtyDaysAgo)
    .reduce((s, d) => s + ((d.pageviews as number) ?? 0), 0)

  const ltConfig = siteDataRes?.data?.linktree_config as Record<string, unknown> | null
  const sharedLinks = Array.isArray(ltConfig?.sharedLinks)
    ? (ltConfig.sharedLinks as Array<Record<string, string>>).map((s, i) => ({
        id: String(i),
        icon: s.icon ?? 'link-2',
        labelPt: s.label_pt ?? s.labelPt ?? '',
        labelEn: s.label_en ?? s.labelEn ?? '',
        url: s.url ?? '',
      }))
    : []

  const tree: LinktreeDisplay = {
    url: shortDomain ? `https://${shortDomain}` : '',
    pageviews: ltTotalViews,
    last30: lt30dViews,
    unique: ltUniqueVisitors,
    engagement: ltTotalViews > 0 ? Math.round((ltUniqueVisitors / ltTotalViews) * 1000) / 10 : 0,
    topCountry: 'BR',
    spark: Array.from({ length: 30 }, () => 0),
    blocks: [],
    sharedLinks,
  }

  // Build AnalyticsDisplay
  const dailyData = dailyRes.data ?? []
  const totalClicks = rawLinks.reduce((s, l) => s + ((l.total_clicks as number) ?? 0), 0)
  const totalUnique = rawLinks.reduce((s, l) => s + ((l.unique_visitors as number) ?? 0), 0)

  const byDay = Array.from({ length: 30 }, () => 0)
  for (const row of dailyData) {
    const d = new Date(row.date as string)
    const daysAgo = Math.floor((Date.now() - d.getTime()) / 86_400_000)
    if (daysAgo >= 0 && daysAgo < 30) {
      byDay[29 - daysAgo]! += (row.clicks as number) ?? 0
    }
  }

  const sourceMap = new Map<string, number>()
  for (const row of sourceRes.data ?? []) {
    const src = (row.source_type as string) ?? 'manual'
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + ((row.total_clicks as number) ?? 0))
  }
  const bySource = Array.from(sourceMap.entries()).map(([id, clicks]) => ({
    id: toSourceId(id),
    clicks,
    pct: totalClicks > 0 ? Math.round((clicks / totalClicks) * 100) : 0,
  }))

  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const row of dailyData) {
    const weekday = (row.weekday as number) ?? 0
    const hourly = row.hourly_clicks as Record<string, number> | null
    if (hourly && typeof hourly === 'object' && weekday >= 0 && weekday < 7) {
      for (const [h, count] of Object.entries(hourly)) {
        const hour = parseInt(h, 10)
        if (hour >= 0 && hour < 24) {
          heatmap[weekday]![hour]! += typeof count === 'number' ? count : 0
        }
      }
    }
  }

  const analytics: AnalyticsDisplay = {
    totalClicks,
    prevClicks: 0,
    unique: totalUnique,
    prevUnique: 0,
    ctr: 0,
    prevCtr: 0,
    qrShare: 0,
    byDay,
    byDayPrev: Array.from({ length: 30 }, () => 0),
    bySource,
    devices: [
      { k: 'Mobile', v: 60, color: '#3FA9C0' },
      { k: 'Desktop', v: 35, color: '#46B17E' },
      { k: 'Tablet', v: 5, color: '#E0A23C' },
    ],
    browsers: [],
    os: [],
    referrers: [],
    countries: [],
    heatmap,
    topLinks: links.slice(0, 10),
    insights: [],
  }

  return (
    <LinksHub
      tree={tree}
      links={links}
      analytics={analytics}
      activeTab={tab}
    />
  )
}
