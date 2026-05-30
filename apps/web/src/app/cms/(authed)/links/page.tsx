import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { LinkDisplay, LinktreeDisplay, AnalyticsDisplay, SourceId } from '@tn-figueiredo/links-admin'
import { SOURCE_LABELS } from '@tn-figueiredo/links-admin'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import { z } from 'zod'
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

function toHealth(raw: unknown): 'ok' | 'warn' | 'broken' {
  if (raw === 'broken' || raw === 'unhealthy' || raw === 'dns_error' || raw === 'timeout') return 'broken'
  if (raw === 'warn') return 'warn'
  return 'ok'
}

const TrackedLinkRow = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string().nullable().default(null),
  destination_url: z.string().default(''),
  source_type: z.string().nullable().default(null),
  active: z.boolean().default(true),
  expires_at: z.string().nullable().default(null),
  total_clicks: z.number().default(0),
  unique_visitors: z.number().default(0),
  health_status: z.string().nullable().default(null),
  redirect_type: z.number().default(301),
  pass_click_ids: z.boolean().default(false),
  created_at: z.string().default(''),
}).passthrough()

export default async function LinksDashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId, timezone } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const validTabs: TabId[] = ['tree', 'links', 'analytics']
  const tab: TabId = validTabs.includes(params.tab as TabId) ? (params.tab as TabId) : 'tree'

  const supabase = getSupabaseServiceClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = toDateStringInTz(sevenDaysAgo, timezone)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const [linksRes, dailyRes, linktreeStatsRes, siteDataRes, sparkRes] = await Promise.all([
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
      .from('linktree_daily_metrics')
      .select('date, pageviews, unique_visitors, countries')
      .eq('site_id', siteId)
      .gte('date', thirtyDaysAgo),
    supabase
      .from('sites')
      .select('short_domain, primary_domain, linktree_config')
      .eq('id', siteId)
      .single(),
    supabase
      .from('link_daily_metrics')
      .select('link_id, date, clicks')
      .eq('site_id', siteId)
      .gte('date', new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10))
      .order('date', { ascending: true }),
  ])

  const rawLinks = linksRes.data ?? []
  const shortDomain = siteDataRes?.data?.short_domain ?? siteDataRes?.data?.primary_domain ?? ''

  // Build per-link sparkline map (last 14 days)
  const sparkMap = new Map<string, number[]>()
  for (const row of (sparkRes.data ?? [])) {
    const linkId = row.link_id as string
    if (!sparkMap.has(linkId)) {
      sparkMap.set(linkId, Array.from({ length: 14 }, () => 0))
    }
    const d = new Date(row.date as string)
    const daysAgo = Math.floor((Date.now() - d.getTime()) / 86_400_000)
    if (daysAgo >= 0 && daysAgo < 14) {
      sparkMap.get(linkId)![13 - daysAgo] = (row.clicks as number) ?? 0
    }
  }

  // Build LinkDisplay[] — Zod-validated
  const validLinks = rawLinks.flatMap((raw) => {
    const parsed = TrackedLinkRow.safeParse(raw)
    if (!parsed.success) return []
    return [parsed.data]
  })

  const links: LinkDisplay[] = validLinks.map((l) => ({
    id: l.id,
    title: l.title ?? l.code,
    slug: `/${l.code}`,
    source: toSourceId(l.source_type ?? 'manual'),
    badge: SOURCE_LABELS[toSourceId(l.source_type ?? 'manual')],
    dest: l.destination_url,
    status: l.active
      ? 'active' as const
      : ((l.expires_at && new Date(l.expires_at) < new Date()) ? 'expired' as const : 'paused' as const),
    clicks: l.total_clicks,
    last30: 0,
    unique: l.unique_visitors,
    scans: 0,
    topCountry: 'BR',
    ctr: 0,
    created: fmtDate(l.created_at),
    health: toHealth(l.health_status),
    redirect: (l.redirect_type === 302 ? 302 : 301) as 301 | 302,
    clickIds: l.pass_click_ids,
    spark: sparkMap.get(l.id) ?? Array.from({ length: 14 }, () => 0),
  }))

  // Build LinktreeDisplay
  const ltStats = linktreeStatsRes?.data ?? []
  const ltTotalViews = ltStats.reduce((s, d) => s + ((d.pageviews as number) ?? 0), 0)
  const ltUniqueVisitors = ltStats.reduce((s, d) => s + ((d.unique_visitors as number) ?? 0), 0)
  const lt30dViews = ltStats
    .filter((d) => (d.date as string) >= thirtyDaysAgo)
    .reduce((s, d) => s + ((d.pageviews as number) ?? 0), 0)

  const ltConfig = siteDataRes?.data?.linktree_config as Record<string, unknown> | null
  const rawSharedLinks = (ltConfig?.shared_links ?? ltConfig?.sharedLinks ?? []) as Array<Record<string, string>>
  const sharedLinks = Array.isArray(rawSharedLinks)
    ? rawSharedLinks.map((s, i) => ({
        id: String(i),
        icon: s.icon ?? 'link-2',
        labelPt: s.label_pt ?? s.labelPt ?? '',
        labelEn: s.label_en ?? s.labelEn ?? '',
        url: s.url ?? '',
      }))
    : []

  const hardcodedBlocks = [
    { id: 'blog-en', label: 'Blog (EN)', section: 'English' },
    { id: 'journal', label: "Thiago's Journal", section: 'English' },
    { id: 'youtube-en', label: 'YouTube (EN)', section: 'English' },
    { id: 'blog-pt', label: 'Blog (PT)', section: 'Português' },
    { id: 'diario', label: 'Diário do Thiago', section: 'Português' },
    { id: 'youtube-pt', label: 'YouTube (PT)', section: 'Português' },
  ]
  const sharedBlocks = sharedLinks.map(s => ({
    id: `shared-${s.id}`,
    label: s.labelPt || s.labelEn,
    section: 'Geral',
  }))
  const allBlocks = [...hardcodedBlocks, ...sharedBlocks]

  const tree: LinktreeDisplay = {
    url: shortDomain ? `https://${shortDomain}` : '',
    pageviews: ltTotalViews,
    last30: lt30dViews,
    unique: ltUniqueVisitors,
    engagement: ltTotalViews > 0 ? Math.round((ltUniqueVisitors / ltTotalViews) * 1000) / 10 : 0,
    topCountry: 'BR',
    spark: Array.from({ length: 30 }, () => 0),
    blocks: allBlocks.map(b => ({ ...b, clicks: 0, ctr: 0 })),
    sharedLinks,
  }

  // Build AnalyticsDisplay
  const dailyData = dailyRes.data ?? []
  const totalClicks = validLinks.reduce((s, l) => s + l.total_clicks, 0)
  const totalUnique = validLinks.reduce((s, l) => s + l.unique_visitors, 0)

  const byDay = Array.from({ length: 30 }, () => 0)
  for (const row of dailyData) {
    const d = new Date(row.date as string)
    const daysAgo = Math.floor((Date.now() - d.getTime()) / 86_400_000)
    if (daysAgo >= 0 && daysAgo < 30) {
      byDay[29 - daysAgo]! += (row.clicks as number) ?? 0
    }
  }

  const sourceMap = new Map<string, number>()
  for (const row of validLinks) {
    const src = row.source_type ?? 'manual'
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + row.total_clicks)
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
        if (Number.isFinite(hour) && hour >= 0 && hour < 24) {
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
    devices: [],
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
