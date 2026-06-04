import { notFound, redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { AnalyticsDisplay } from '@tn-figueiredo/links-admin'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import { AnalyticsView } from '../../_components/analytics-view'
import { getAiInsightsForLink } from '@/lib/links/insights'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

const DEVICE_COLORS: Record<string, string> = { mobile: '#F2683C', desktop: '#3FA9C0', tablet: '#A77CE8', bot: '#8A8F98', other: '#8A8F98' }
const DEVICE_LABELS: Record<string, string> = { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet', bot: 'Bot', other: 'Outro' }
const COUNTRY_NAMES: Record<string, string> = { BR: 'Brasil', US: 'Estados Unidos', PT: 'Portugal', DE: 'Alemanha', FR: 'França', GB: 'Reino Unido', ES: 'Espanha', AR: 'Argentina', JP: 'Japão', MX: 'México' }

export default async function LinkAnalyticsPage({ params }: Props) {
  const { id } = await params
  const { siteId, timezone } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const { data: link, error: linkError } = await supabase
    .from('tracked_links')
    .select('id, title, code, destination_url, source_type, total_clicks, unique_visitors, created_at')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (linkError || !link) notFound()

  const dateFrom = toDateStringInTz(new Date(Date.now() - 30 * 86_400_000), timezone)
  const dateTo = toDateStringInTz(new Date(), timezone)

  const [metricsRes, clickEventsRes] = await Promise.all([
    supabase
      .from('link_daily_metrics')
      .select('date, clicks, unique_visitors, countries, hourly_clicks')
      .eq('link_id', id)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true }),
    supabase
      .from('link_clicks')
      .select('country, city, device_type, browser, os, referrer_domain, clicked_at')
      .eq('link_id', id)
      .gte('clicked_at', `${dateFrom}T00:00:00Z`)
      .lte('clicked_at', `${dateTo}T23:59:59Z`)
      .order('clicked_at', { ascending: false })
      .limit(5000),
  ])

  const dailyMetrics = metricsRes.data ?? []
  const clickEvents = clickEventsRes.data ?? []

  // byDay — 30 slots
  const byDay = Array.from({ length: 30 }, () => 0)
  for (const row of dailyMetrics) {
    const d = new Date(row.date as string)
    const daysAgo = Math.floor((Date.now() - d.getTime()) / 86_400_000)
    if (daysAgo >= 0 && daysAgo < 30) byDay[29 - daysAgo]! += (row.clicks as number) ?? 0
  }

  const totalClicks = byDay.reduce((s, v) => s + v, 0)
  const totalUnique = dailyMetrics.reduce((s, m) => s + ((m.unique_visitors as number) ?? 0), 0)

  // Heatmap — 7 days x 24 hours
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const ev of clickEvents) {
    const d = new Date(ev.clicked_at as string)
    const weekday = (d.getDay() + 6) % 7
    const hour = d.getHours()
    if (weekday >= 0 && weekday < 7 && hour >= 0 && hour < 24) heatmap[weekday]![hour]! += 1
  }

  // Device / browser / OS / referrer from click events
  const deviceCounts = new Map<string, number>()
  const browserCounts = new Map<string, number>()
  const osCounts = new Map<string, number>()
  const referrerCounts = new Map<string, number>()
  const countryCounts = new Map<string, number>()
  const countryCities = new Map<string, Map<string, number>>()

  for (const ev of clickEvents) {
    const dt = (ev.device_type as string) || 'other'
    deviceCounts.set(dt, (deviceCounts.get(dt) ?? 0) + 1)

    const br = (ev.browser as string) || 'Outro'
    browserCounts.set(br, (browserCounts.get(br) ?? 0) + 1)

    const os = (ev.os as string) || 'Outro'
    osCounts.set(os, (osCounts.get(os) ?? 0) + 1)

    const ref = (ev.referrer_domain as string) || 'Direto'
    referrerCounts.set(ref, (referrerCounts.get(ref) ?? 0) + 1)

    const c = ev.country as string | null
    if (c) {
      countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1)
      const rawCity = ev.city as string | null
      const city = rawCity ? decodeURIComponent(rawCity) : null
      if (city) {
        if (!countryCities.has(c)) countryCities.set(c, new Map())
        const cityMap = countryCities.get(c)!
        cityMap.set(city, (cityMap.get(city) ?? 0) + 1)
      }
    }
  }

  function pctTop(m: Map<string, number>, n: number) {
    const total = Array.from(m.values()).reduce((s, v) => s + v, 0) || 1
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([k, v]) => ({ k, v: Math.round((v / total) * 100) }))
  }

  const deviceTotal = Array.from(deviceCounts.values()).reduce((s, v) => s + v, 0) || 1
  const devices = Array.from(deviceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ k: DEVICE_LABELS[k] ?? k, v: Math.round((v / deviceTotal) * 100), color: DEVICE_COLORS[k] ?? '#8A8F98' }))

  const countryTotal = Array.from(countryCounts.values()).reduce((s, v) => s + v, 0) || 1
  const countries = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([code, v]) => {
      const cityMap = countryCities.get(code)
      const topCities = cityMap ? Array.from(cityMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name) : []
      return { code, name: COUNTRY_NAMES[code] ?? code, v: Math.round((v / countryTotal) * 100), cities: topCities }
    })

  // Per-link AI insights — cached 1h by the engine
  const rawInsights = await getAiInsightsForLink(id)
  const formattedInsights = rawInsights.map((text) => ({
    tone: 'accent' as const,
    icon: 'sparkle',
    text,
  }))

  const linkSource = (link.source_type as string) ?? 'manual'
  const SOURCE_DISPLAY: Record<string, string> = { newsletter: 'Newsletter', social: 'Social', blog: 'Blog', qr: 'QR / impresso', campaign: 'Campanha', manual: 'Manual', print: 'Print' }

  const analytics: AnalyticsDisplay = {
    totalClicks,
    prevClicks: 0,
    unique: totalUnique,
    prevUnique: 0,
    ctr: totalClicks > 0 ? Math.round((totalUnique / totalClicks) * 1000) / 10 : 0,
    prevCtr: 0,
    qrShare: linkSource === 'qr' ? 100 : 0,
    byDay,
    byDayPrev: Array.from({ length: 30 }, () => 0),
    bySource: [{ id: linkSource as AnalyticsDisplay['bySource'][0]['id'], label: SOURCE_DISPLAY[linkSource] ?? linkSource, clicks: totalClicks, pct: 100 }],
    devices,
    browsers: pctTop(browserCounts, 5),
    os: pctTop(osCounts, 5),
    referrers: pctTop(referrerCounts, 5),
    countries,
    heatmap,
    topLinks: [],
    insights: formattedInsights,
  }

  const linkTitle = (link.title as string) ?? null
  const linkCode = link.code as string

  return (
    <div style={{ padding: '20px 30px 20px' }}>
      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        flexWrap: 'nowrap', minWidth: 0, marginBottom: 10,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 17H7A5 5 0 017 7h2" />
            <path d="M15 7h2a5 5 0 110 10h-2" />
            <line x1="8" x2="16" y1="12" y2="12" />
          </svg>
          Social
        </span>

        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }}>
          <path d="M9 6l6 6-6 6" />
        </svg>

        <a
          href="/cms/links"
          style={{
            fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)',
            cursor: 'pointer', textDecoration: 'none',
          }}
        >
          Links
        </a>

        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }}>
          <path d="M9 6l6 6-6 6" />
        </svg>

        <a
          href={`/cms/links/${id}`}
          style={{
            fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)',
            cursor: 'pointer', textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {linkTitle ?? `/${linkCode}`}
        </a>

        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }}>
          <path d="M9 6l6 6-6 6" />
        </svg>

        <span style={{
          fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          Analytics
        </span>
      </div>

      {/* Reuse same analytics layout as hub */}
      <AnalyticsView data={analytics} />
    </div>
  )
}
