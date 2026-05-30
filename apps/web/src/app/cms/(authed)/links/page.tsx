import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { LinkDisplay, LinktreeDisplay, AnalyticsDisplay, SourceId } from '@tn-figueiredo/links-admin'
import { SOURCE_LABELS } from '@tn-figueiredo/links-admin'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import { z } from 'zod'
import { getLatestPost, getLatestVideo } from '@/app/go/linktree/_lib/queries'
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
  const tab: TabId = validTabs.includes(params.tab as TabId) ? (params.tab as TabId) : 'links'

  const supabase = getSupabaseServiceClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = toDateStringInTz(sevenDaysAgo, timezone)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const [linksRes, dailyRes, linktreeStatsRes, siteDataRes, sparkRes, latestPost, latestVideo, ltDevicesRes, ltBrowsersRes, ltReferrersRes, ltOsRes, ltDailyEventsRes] = await Promise.all([
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
    getLatestPost(siteId, 'en'),
    getLatestVideo(siteId),
    supabase
      .from('linktree_events')
      .select('device_type')
      .eq('site_id', siteId)
      .eq('event_type', 'pageview')
      .not('device_type', 'is', null),
    supabase
      .from('linktree_events')
      .select('browser')
      .eq('site_id', siteId)
      .eq('event_type', 'pageview')
      .not('browser', 'is', null),
    supabase
      .from('linktree_events')
      .select('referrer_source')
      .eq('site_id', siteId)
      .eq('event_type', 'pageview')
      .not('referrer_source', 'is', null),
    supabase
      .from('linktree_events')
      .select('os')
      .eq('site_id', siteId)
      .eq('event_type', 'pageview')
      .not('os', 'is', null),
    supabase
      .from('linktree_events')
      .select('created_at, country, city, device_type')
      .eq('site_id', siteId)
      .eq('event_type', 'pageview')
      .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
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

  const tree: LinktreeDisplay = {
    url: shortDomain ? `https://${shortDomain}` : '',
    pageviews: ltTotalViews,
    last30: lt30dViews,
    unique: ltUniqueVisitors,
    engagement: ltTotalViews > 0 ? Math.round((ltUniqueVisitors / ltTotalViews) * 1000) / 10 : 0,
    topCountry: 'BR',
    spark: Array.from({ length: 30 }, () => 0),
    blocks: [
      { id: 'linktree', label: 'Linktree (porta de entrada)', section: 'Página', clicks: ltTotalViews, ctr: ltTotalViews > 0 ? 100 : 0 },
      ...links.map(l => ({
        id: l.id,
        label: l.title,
        section: l.source === 'newsletter' ? 'Newsletter' : l.source === 'blog' ? 'Blog' : l.badge,
        clicks: l.clicks,
        ctr: l.clicks > 0 && ltTotalViews > 0 ? Math.round((l.clicks / ltTotalViews) * 1000) / 10 : 0,
      })),
    ],
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

  // Count linktree link_click events by key for "Por origem"
  const ltClickEvents = (ltDailyEventsRes.data ?? []).length
  const sourceMap = new Map<string, number>()
  sourceMap.set('linktree', ltTotalViews)
  for (const row of validLinks) {
    const src = row.source_type ?? 'manual'
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + row.total_clicks)
  }
  const allSourceTotal = Array.from(sourceMap.values()).reduce((s, v) => s + v, 0) || 1
  const SOURCE_DISPLAY: Record<string, string> = { linktree: 'Linktree', newsletter: 'Newsletter', social: 'Social', blog: 'Blog', qr: 'QR / impresso', campaign: 'Campanha', manual: 'Manual' }
  const bySource = Array.from(sourceMap.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, clicks]) => ({
      id: toSourceId(id === 'linktree' ? 'manual' : id),
      label: SOURCE_DISPLAY[id] ?? id,
      clicks,
      pct: Math.round((clicks / allSourceTotal) * 100),
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

  // Aggregate linktree events for device/browser/referrer breakdowns
  const deviceCounts = new Map<string, number>()
  for (const row of ltDevicesRes.data ?? []) {
    const dt = (row.device_type as string) ?? 'other'
    deviceCounts.set(dt, (deviceCounts.get(dt) ?? 0) + 1)
  }
  const deviceTotal = Array.from(deviceCounts.values()).reduce((s, v) => s + v, 0) || 1
  const DEVICE_COLORS: Record<string, string> = { mobile: '#F2683C', desktop: '#3FA9C0', tablet: '#A77CE8', bot: '#8A8F98', other: '#8A8F98' }
  const DEVICE_LABELS: Record<string, string> = { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet', bot: 'Bot', other: 'Outro' }
  const devices = Array.from(deviceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ k: DEVICE_LABELS[k] ?? k, v: Math.round((v / deviceTotal) * 100), color: DEVICE_COLORS[k] ?? '#8A8F98' }))

  const browserCounts = new Map<string, number>()
  for (const row of ltBrowsersRes.data ?? []) {
    const b = (row.browser as string) ?? 'Outro'
    browserCounts.set(b, (browserCounts.get(b) ?? 0) + 1)
  }
  const browserTotal = Array.from(browserCounts.values()).reduce((s, v) => s + v, 0) || 1
  const browsers = Array.from(browserCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => ({ k, v: Math.round((v / browserTotal) * 100) }))

  const referrerCounts = new Map<string, number>()
  for (const row of ltReferrersRes.data ?? []) {
    const r = (row.referrer_source as string) ?? 'direct'
    const label = r === 'direct' ? 'Direto / QR' : r === 'social' ? 'Social' : r === 'search' ? 'Google' : r === 'email' ? 'Newsletter' : r
    referrerCounts.set(label, (referrerCounts.get(label) ?? 0) + 1)
  }
  const referrerTotal = Array.from(referrerCounts.values()).reduce((s, v) => s + v, 0) || 1
  const referrers = Array.from(referrerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => ({ k, v: Math.round((v / referrerTotal) * 100) }))

  // OS aggregation from linktree_events
  const osCounts = new Map<string, number>()
  for (const row of ltOsRes.data ?? []) {
    const o = (row.os as string) ?? 'Outro'
    osCounts.set(o, (osCounts.get(o) ?? 0) + 1)
  }
  const osTotal = Array.from(osCounts.values()).reduce((s, v) => s + v, 0) || 1
  const osData = Array.from(osCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => ({ k, v: Math.round((v / osTotal) * 100) }))

  // Add linktree events to byDay (cliques por dia)
  for (const row of ltDailyEventsRes.data ?? []) {
    const d = new Date(row.created_at as string)
    const daysAgo = Math.floor((Date.now() - d.getTime()) / 86_400_000)
    if (daysAgo >= 0 && daysAgo < 30) {
      byDay[29 - daysAgo]! += 1
    }
  }

  // Add linktree events to heatmap
  for (const row of ltDailyEventsRes.data ?? []) {
    const d = new Date(row.created_at as string)
    const weekday = (d.getDay() + 6) % 7 // Mon=0, Sun=6
    const hour = d.getHours()
    if (weekday >= 0 && weekday < 7 && hour >= 0 && hour < 24) {
      heatmap[weekday]![hour]! += 1
    }
  }

  // Countries + cities from linktree_events
  const countryCounts = new Map<string, number>()
  const countryCities = new Map<string, Map<string, number>>()
  for (const row of ltDailyEventsRes.data ?? []) {
    const c = (row.country as string | null)
    if (c) {
      countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1)
      const rawCity = (row.city as string | null)
      const city = rawCity ? decodeURIComponent(rawCity) : null
      if (city) {
        if (!countryCities.has(c)) countryCities.set(c, new Map())
        const cityMap = countryCities.get(c)!
        cityMap.set(city, (cityMap.get(city) ?? 0) + 1)
      }
    }
  }
  const countryTotal = Array.from(countryCounts.values()).reduce((s, v) => s + v, 0) || 1
  const COUNTRY_NAMES: Record<string, string> = { BR: 'Brasil', US: 'Estados Unidos', PT: 'Portugal', DE: 'Alemanha', FR: 'França', GB: 'Reino Unido', ES: 'Espanha', AR: 'Argentina', JP: 'Japão', TH: 'Tailândia', MX: 'México', CO: 'Colômbia' }
  const countries = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([code, v]) => {
      const cityMap = countryCities.get(code)
      const topCities = cityMap
        ? Array.from(cityMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name)
        : []
      return { code, name: COUNTRY_NAMES[code] ?? code, v: Math.round((v / countryTotal) * 100), cities: topCities }
    })

  const allClicks = totalClicks + ltTotalViews
  const allUnique = totalUnique + ltUniqueVisitors
  const engagementCtr = ltTotalViews > 0 ? Math.round((ltUniqueVisitors / ltTotalViews) * 1000) / 10 : 0

  // Build top links including linktree
  const linktreeAsLink: LinkDisplay = {
    id: 'linktree',
    title: 'Linktree (porta de entrada)',
    slug: '/go',
    source: 'manual' as const,
    badge: 'Linktree',
    dest: tree.url,
    status: 'active' as const,
    clicks: ltTotalViews,
    last30: lt30dViews,
    unique: ltUniqueVisitors,
    scans: 0, topCountry: 'BR', ctr: engagementCtr,
    created: '', health: 'ok' as const, redirect: 301 as const,
    clickIds: false, spark: Array.from({ length: 14 }, () => 0),
  }
  const allTopLinks = [linktreeAsLink, ...links].sort((a, b) => b.clicks - a.clicks).slice(0, 10)

  const analytics: AnalyticsDisplay = {
    totalClicks: allClicks,
    prevClicks: 0,
    unique: allUnique,
    prevUnique: 0,
    ctr: engagementCtr,
    prevCtr: 0,
    qrShare: 0,
    byDay,
    byDayPrev: Array.from({ length: 30 }, () => 0),
    bySource,
    devices,
    browsers,
    os: osData,
    referrers,
    countries,
    heatmap,
    topLinks: allTopLinks,
    insights: [],
  }

  const latestContentPost = latestPost ? {
    title: latestPost.title,
    meta: `${new Date(latestPost.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} · ${latestPost.readingTimeMin} min${latestPost.tagName ? ` · ${latestPost.tagName}` : ''}`,
  } : null

  const latestContentVideo = latestVideo ? {
    title: latestVideo.title,
    meta: `${new Date(latestVideo.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} · ${latestVideo.duration} · ${latestVideo.viewCount.toLocaleString('pt-BR')} views`,
  } : null

  return (
    <LinksHub
      tree={tree}
      links={links}
      analytics={analytics}
      activeTab={tab}
      latestPost={latestContentPost}
      latestVideo={latestContentVideo}
    />
  )
}
