# Analytics Page Redesign — Implementation Plan

Tasks 10–19. Route: `/cms/analytics`. ~4–5h total.

---

### Task 10: Analytics Helpers

**Files:**
- Create: `apps/web/lib/analytics/link-classifier.ts`
- Create: `apps/web/lib/analytics/engagement-score.ts`
- Create: `apps/web/lib/analytics/insights-engine.ts`
- Test: `apps/web/test/lib/analytics/link-classifier.test.ts`
- Test: `apps/web/test/lib/analytics/engagement-score.test.ts`
- Test: `apps/web/test/lib/analytics/insights-engine.test.ts`

- [ ] **Step 1: Create `link-classifier.ts` — classify a URL as in-house, external, or go/ shortlink**

```ts
// apps/web/lib/analytics/link-classifier.ts

export type LinkType = 'internal' | 'external' | 'shortlink'

const SHORTLINK_PATTERNS = [/^\/go\//, /^https?:\/\/go\./]

export function classifyLink(href: string, siteOrigin: string): LinkType {
  if (SHORTLINK_PATTERNS.some((p) => p.test(href))) return 'shortlink'
  try {
    const url = new URL(href, siteOrigin)
    if (url.origin === siteOrigin) return 'internal'
  } catch {
    // relative URL — treat as internal
    if (!href.startsWith('http')) return 'internal'
  }
  return 'external'
}

export function linkTypeBadgeColor(type: LinkType): string {
  switch (type) {
    case 'internal':   return 'var(--color-int, #60a5fa)'
    case 'external':   return 'var(--color-link, #38bdf8)'
    case 'shortlink':  return 'var(--color-blog, #34d399)'
  }
}

export function linkTypeLabel(type: LinkType): string {
  switch (type) {
    case 'internal':  return 'In-house'
    case 'external':  return 'External'
    case 'shortlink': return 'go/'
  }
}
```

- [ ] **Step 2: Create `engagement-score.ts` — compute 0–100 score from content_metrics row**

```ts
// apps/web/lib/analytics/engagement-score.ts

export interface EngagementInput {
  views: number
  readsComplete: number
  avgDepth: number  // 0–100
  avgTime: number   // seconds
}

// Weights: completion 40%, depth 30%, time (capped at 300s) 30%
export function computeEngagementScore(input: EngagementInput): number {
  if (input.views === 0) return 0
  const completionRate = Math.min(input.readsComplete / input.views, 1)
  const depthNorm = input.avgDepth / 100
  const timeNorm = Math.min(input.avgTime / 300, 1)
  const raw = completionRate * 40 + depthNorm * 30 + timeNorm * 30
  return Math.round(raw)
}

export function engagementLabel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 65) return 'high'
  if (score >= 35) return 'medium'
  return 'low'
}
```

- [ ] **Step 3: Create `insights-engine.ts` — rule-based insights for the strip**

```ts
// apps/web/lib/analytics/insights-engine.ts

export interface FunnelData {
  views: number
  read50: number
  clickedLink: number
  nlOpened: number
  subscribed: number
}

export interface LinkStats {
  totalClicks: number
  prevTotalClicks: number
  topSource: string
  topSourceClicks: number
}

export interface InsightCard {
  kind: 'leak' | 'win' | 'opportunity'
  title: string
  body: string
  color: string
}

export function generateInsights(
  funnel: FunnelData,
  links: LinkStats,
): InsightCard[] {
  const cards: InsightCard[] = []

  // Biggest leak: largest absolute drop in funnel
  const stages = [
    { label: 'Views → Read 50%+', drop: funnel.views - funnel.read50 },
    { label: 'Read 50%+ → Clicked Link', drop: funnel.read50 - funnel.clickedLink },
    { label: 'Clicked Link → NL Opened', drop: funnel.clickedLink - funnel.nlOpened },
    { label: 'NL Opened → Subscribed', drop: funnel.nlOpened - funnel.subscribed },
  ]
  const biggest = stages.reduce((a, b) => (b.drop > a.drop ? b : a), stages[0])
  if (biggest && funnel.views > 0) {
    const pct = Math.round((biggest.drop / funnel.views) * 100)
    cards.push({
      kind: 'leak',
      title: 'Biggest Leak',
      body: `${biggest.label}: ${pct}% of readers lost here`,
      color: 'var(--color-danger, #f87171)',
    })
  }

  // Winning pattern: click growth
  const growth = links.prevTotalClicks > 0
    ? Math.round(((links.totalClicks - links.prevTotalClicks) / links.prevTotalClicks) * 100)
    : 0
  if (growth > 0) {
    cards.push({
      kind: 'win',
      title: 'Winning Pattern',
      body: `Link clicks up ${growth}% vs previous period — ${links.topSource} drives ${links.topSourceClicks} of those`,
      color: 'var(--color-success, #4ade80)',
    })
  } else if (funnel.views > 0 && funnel.read50 / funnel.views > 0.4) {
    cards.push({
      kind: 'win',
      title: 'Strong Engagement',
      body: `${Math.round((funnel.read50 / funnel.views) * 100)}% of readers reach 50%+ — above benchmark`,
      color: 'var(--color-success, #4ade80)',
    })
  }

  // Opportunity: NL conversion gap
  if (funnel.clickedLink > 0 && funnel.nlOpened / funnel.clickedLink < 0.2) {
    cards.push({
      kind: 'opportunity',
      title: 'Opportunity',
      body: 'Low email open rate vs link clicks — try more prominent inline NL CTAs',
      color: 'var(--color-accent, #818cf8)',
    })
  } else if (funnel.read50 > 0 && funnel.clickedLink / funnel.read50 < 0.1) {
    cards.push({
      kind: 'opportunity',
      title: 'Opportunity',
      body: 'Readers finish but rarely click — add more relevant in-content links',
      color: 'var(--color-accent, #818cf8)',
    })
  }

  return cards.slice(0, 3)
}
```

- [ ] **Step 4: Write tests for all three helpers**

```ts
// apps/web/test/lib/analytics/link-classifier.test.ts
import { describe, it, expect } from 'vitest'
import { classifyLink } from '@/lib/analytics/link-classifier'

describe('classifyLink', () => {
  const origin = 'https://bythiagofigueiredo.com'

  it('classifies same-origin URL as internal', () => {
    expect(classifyLink('https://bythiagofigueiredo.com/blog/foo', origin)).toBe('internal')
  })
  it('classifies /go/ prefix as shortlink', () => {
    expect(classifyLink('/go/abc123', origin)).toBe('shortlink')
  })
  it('classifies go. subdomain as shortlink', () => {
    expect(classifyLink('https://go.bythiagofigueiredo.com/abc', origin)).toBe('shortlink')
  })
  it('classifies external domain as external', () => {
    expect(classifyLink('https://youtube.com/watch?v=1', origin)).toBe('external')
  })
  it('classifies relative path (no /go/) as internal', () => {
    expect(classifyLink('/about', origin)).toBe('internal')
  })
})
```

```ts
// apps/web/test/lib/analytics/engagement-score.test.ts
import { describe, it, expect } from 'vitest'
import { computeEngagementScore, engagementLabel } from '@/lib/analytics/engagement-score'

describe('computeEngagementScore', () => {
  it('returns 0 for zero views', () => {
    expect(computeEngagementScore({ views: 0, readsComplete: 0, avgDepth: 0, avgTime: 0 })).toBe(0)
  })
  it('returns 100 for perfect engagement', () => {
    expect(computeEngagementScore({ views: 100, readsComplete: 100, avgDepth: 100, avgTime: 300 })).toBe(100)
  })
  it('caps time contribution at 300s', () => {
    const a = computeEngagementScore({ views: 10, readsComplete: 0, avgDepth: 0, avgTime: 300 })
    const b = computeEngagementScore({ views: 10, readsComplete: 0, avgDepth: 0, avgTime: 600 })
    expect(a).toBe(b)
  })
  it('labels correctly', () => {
    expect(engagementLabel(70)).toBe('high')
    expect(engagementLabel(50)).toBe('medium')
    expect(engagementLabel(20)).toBe('low')
  })
})
```

```ts
// apps/web/test/lib/analytics/insights-engine.test.ts
import { describe, it, expect } from 'vitest'
import { generateInsights } from '@/lib/analytics/insights-engine'

describe('generateInsights', () => {
  it('generates a leak card when funnel has drops', () => {
    const cards = generateInsights(
      { views: 1000, read50: 200, clickedLink: 50, nlOpened: 10, subscribed: 2 },
      { totalClicks: 50, prevTotalClicks: 40, topSource: 'Blog', topSourceClicks: 30 },
    )
    expect(cards.some((c) => c.kind === 'leak')).toBe(true)
  })
  it('returns max 3 cards', () => {
    const cards = generateInsights(
      { views: 1000, read50: 100, clickedLink: 5, nlOpened: 1, subscribed: 0 },
      { totalClicks: 10, prevTotalClicks: 5, topSource: 'NL', topSourceClicks: 5 },
    )
    expect(cards.length).toBeLessThanOrEqual(3)
  })
  it('generates win card on positive click growth', () => {
    const cards = generateInsights(
      { views: 500, read50: 300, clickedLink: 50, nlOpened: 20, subscribed: 5 },
      { totalClicks: 120, prevTotalClicks: 80, topSource: 'Blog', topSourceClicks: 60 },
    )
    expect(cards.some((c) => c.kind === 'win')).toBe(true)
  })
})
```

---

### Task 11: Analytics Queries

**Files:**
- Create: `apps/web/lib/analytics/analytics-queries.ts`
- Modify: `apps/web/src/app/cms/(authed)/analytics/types.ts`
- Test: `apps/web/test/lib/analytics/analytics-queries.test.ts`

- [ ] **Step 1: Extend `types.ts` with new query result types**

```ts
// Add to apps/web/src/app/cms/(authed)/analytics/types.ts

export interface KpiData {
  totalViews: number
  uniqueVisitors: number
  linkClicks: number
  avgReadDepth: number       // 0–100
  nlOpenRate: number         // 0–100
  subscribers: number
  // previous period (null = no comparison)
  prevTotalViews: number | null
  prevUniqueVisitors: number | null
  prevLinkClicks: number | null
  prevAvgReadDepth: number | null
  prevNlOpenRate: number | null
  prevSubscribers: number | null
  // sparkline: last 7 data points for each KPI
  viewsSparkline: number[]
  clicksSparkline: number[]
}

export interface FunnelData {
  views: number
  read50: number        // read_depth >= 50
  clickedLink: number   // content_events with event_type='link_click'
  nlOpened: number
  subscribed: number
}

export interface ClickedLink {
  url: string
  title: string | null
  type: 'internal' | 'external' | 'shortlink'
  clicks: number
  topSource: string | null  // referrer_src of content_event that preceded it
  shareOfTotal: number      // 0–1
}

export interface ClicksDestination {
  internal: number
  external: number
  youtube: number
  affiliate: number
  total: number
}

export interface ClicksSource {
  blog: number
  newsletter: number
  video: number
  social: number
  other: number
}

export interface ClicksChartPoint {
  date: string
  clicks: number
  prevClicks: number  // previous period (0 if no comparison)
  avg: number         // rolling average across period
}
```

- [ ] **Step 2: Create `analytics-queries.ts` — all server-side data-fetching helpers**

```ts
// apps/web/lib/analytics/analytics-queries.ts
'server-only'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import type {
  PeriodInput,
  KpiData,
  FunnelData,
  ClickedLink,
  ClicksDestination,
  ClicksSource,
  ClicksChartPoint,
} from '@/app/cms/(authed)/analytics/types'
import { classifyLink } from './link-classifier'

function resolveDateRange(period: PeriodInput): { start: Date; end: Date } {
  const end = new Date()
  if (period.type === 'custom') {
    return { start: new Date(period.start), end: new Date(period.end) }
  }
  if (period.value === 'all') return { start: new Date('2020-01-01'), end }
  const days = period.value === '7d' ? 7 : period.value === '90d' ? 90 : 30
  const start = new Date()
  start.setDate(start.getDate() - days)
  return { start, end }
}

function resolvePrevRange(period: PeriodInput): { start: Date; end: Date } | null {
  if (period.type !== 'preset' || period.value === 'all') return null
  const days = period.value === '7d' ? 7 : period.value === '90d' ? 90 : 30
  const end = new Date()
  end.setDate(end.getDate() - days)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { start, end }
}

export async function fetchKpiData(period: PeriodInput): Promise<KpiData> {
  const { siteId, timezone } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)
  const prev = resolvePrevRange(period)

  const [metricsRes, linkRes, subsRes, editionsRes] = await Promise.all([
    supabase
      .from('content_metrics')
      .select('date, views, unique_views, avg_read_depth')
      .eq('site_id', siteId)
      .gte('date', toDateStringInTz(start, timezone))
      .lte('date', toDateStringInTz(end, timezone))
      .order('date', { ascending: true }),
    supabase
      .from('link_daily_metrics')
      .select('date, clicks')
      .eq('site_id', siteId)
      .gte('date', toDateStringInTz(start, timezone))
      .lte('date', toDateStringInTz(end, timezone))
      .order('date', { ascending: true }),
    supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'confirmed'),
    supabase
      .from('newsletter_editions')
      .select('stats_delivered, stats_opens')
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .gte('sent_at', start.toISOString())
      .lte('sent_at', end.toISOString()),
  ])

  const metrics = metricsRes.data ?? []
  const linkMetrics = linkRes.data ?? []
  const editions = editionsRes.data ?? []

  const totalViews = metrics.reduce((s, r) => s + r.views, 0)
  const uniqueVisitors = metrics.reduce((s, r) => s + r.unique_views, 0)
  const totalDelivered = editions.reduce((s, e) => s + (e.stats_delivered ?? 0), 0)
  const totalOpens = editions.reduce((s, e) => s + (e.stats_opens ?? 0), 0)
  const nlOpenRate = totalDelivered > 0 ? Math.round((totalOpens / totalDelivered) * 100) : 0
  const linkClicks = linkMetrics.reduce((s, r) => s + r.clicks, 0)

  const avgReadDepth = totalViews > 0
    ? Math.round(metrics.reduce((s, r) => s + r.avg_read_depth * r.views, 0) / totalViews)
    : 0

  // Sparklines: last 7 days aggregate
  const last7Metrics = metrics.slice(-7)
  const last7Links = linkMetrics.slice(-7)
  const viewsSparkline = last7Metrics.map((r) => r.views)
  const clicksSparkline = last7Links.map((r) => r.clicks)

  // Previous period
  let prevTotalViews: number | null = null
  let prevUniqueVisitors: number | null = null
  let prevLinkClicks: number | null = null
  let prevAvgReadDepth: number | null = null
  let prevNlOpenRate: number | null = null
  let prevSubscribers: number | null = null

  if (prev) {
    const [pm, pl, pe] = await Promise.all([
      supabase
        .from('content_metrics')
        .select('views, unique_views, avg_read_depth')
        .eq('site_id', siteId)
        .gte('date', toDateStringInTz(prev.start, timezone))
        .lte('date', toDateStringInTz(prev.end, timezone)),
      supabase
        .from('link_daily_metrics')
        .select('clicks')
        .eq('site_id', siteId)
        .gte('date', toDateStringInTz(prev.start, timezone))
        .lte('date', toDateStringInTz(prev.end, timezone)),
      supabase
        .from('newsletter_editions')
        .select('stats_delivered, stats_opens')
        .eq('site_id', siteId)
        .eq('status', 'sent')
        .gte('sent_at', prev.start.toISOString())
        .lte('sent_at', prev.end.toISOString()),
    ])
    const pm_ = pm.data ?? []
    prevTotalViews = pm_.reduce((s, r) => s + r.views, 0)
    prevUniqueVisitors = pm_.reduce((s, r) => s + r.unique_views, 0)
    prevLinkClicks = (pl.data ?? []).reduce((s, r) => s + r.clicks, 0)
    const pViews = pm_.reduce((s, r) => s + r.views, 0)
    prevAvgReadDepth = pViews > 0
      ? Math.round(pm_.reduce((s, r) => s + r.avg_read_depth * r.views, 0) / pViews)
      : 0
    const pd = pe.data ?? []
    const pDel = pd.reduce((s, e) => s + (e.stats_delivered ?? 0), 0)
    const pOp = pd.reduce((s, e) => s + (e.stats_opens ?? 0), 0)
    prevNlOpenRate = pDel > 0 ? Math.round((pOp / pDel) * 100) : 0
    prevSubscribers = null // subscriber count is live, not period-bounded
  }

  return {
    totalViews,
    uniqueVisitors,
    linkClicks,
    avgReadDepth,
    nlOpenRate,
    subscribers: subsRes.count ?? 0,
    prevTotalViews,
    prevUniqueVisitors,
    prevLinkClicks,
    prevAvgReadDepth,
    prevNlOpenRate,
    prevSubscribers,
    viewsSparkline,
    clicksSparkline,
  }
}

export async function fetchFunnelData(period: PeriodInput): Promise<FunnelData> {
  const { siteId, timezone } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  const [metricsRes, linkClicksRes, editionsRes, subsRes] = await Promise.all([
    supabase
      .from('content_metrics')
      .select('views, reads_complete, avg_read_depth')
      .eq('site_id', siteId)
      .gte('date', toDateStringInTz(start, timezone))
      .lte('date', toDateStringInTz(end, timezone)),
    supabase
      .from('content_events')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('event_type', 'link_click')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString()),
    supabase
      .from('newsletter_editions')
      .select('stats_delivered, stats_opens')
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .gte('sent_at', start.toISOString())
      .lte('sent_at', end.toISOString()),
    supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'confirmed')
      .gte('subscribed_at', start.toISOString())
      .lte('subscribed_at', end.toISOString()),
  ])

  const metrics = metricsRes.data ?? []
  const views = metrics.reduce((s, r) => s + r.views, 0)
  // Estimate read50 from avg_read_depth: rows where avg_read_depth >= 50, weighted by views
  const read50 = metrics
    .filter((r) => r.avg_read_depth >= 50)
    .reduce((s, r) => s + r.reads_complete, 0)

  const editions = editionsRes.data ?? []
  const nlOpened = editions.reduce((s, e) => s + (e.stats_opens ?? 0), 0)

  return {
    views,
    read50,
    clickedLink: linkClicksRes.count ?? 0,
    nlOpened,
    subscribed: subsRes.count ?? 0,
  }
}

export async function fetchTopLinks(
  period: PeriodInput,
  siteOrigin: string,
): Promise<ClickedLink[]> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  // Use link_daily_metrics for performance + join to links table for URL
  const { data } = await supabase
    .from('link_daily_metrics')
    .select('link_id, clicks, ref_email, ref_search, ref_social, ref_referral, ref_direct, ref_other')
    .eq('site_id', siteId)
    .gte('date', toDateStringInTz(start, await getSiteContext().then((c) => c.timezone)))
    .lte('date', toDateStringInTz(end, await getSiteContext().then((c) => c.timezone)))

  if (!data || data.length === 0) return []

  // Aggregate by link_id
  const byLink = new Map<string, {
    clicks: number; email: number; search: number; social: number
    referral: number; direct: number; other: number
  }>()
  for (const row of data) {
    const ex = byLink.get(row.link_id) ?? {
      clicks: 0, email: 0, search: 0, social: 0, referral: 0, direct: 0, other: 0
    }
    ex.clicks += row.clicks
    ex.email += row.ref_email
    ex.search += row.ref_search
    ex.social += row.ref_social
    ex.referral += row.ref_referral
    ex.direct += row.ref_direct
    ex.other += row.ref_other
    byLink.set(row.link_id, ex)
  }

  // Get link URLs
  const ids = Array.from(byLink.keys())
  const { data: links } = await supabase
    .from('links')
    .select('id, dest_url, title')
    .in('id', ids)

  const urlMap = new Map<string, { url: string; title: string | null }>()
  for (const l of links ?? []) {
    urlMap.set(l.id, { url: l.dest_url, title: l.title ?? null })
  }

  const total = Array.from(byLink.values()).reduce((s, v) => s + v.clicks, 0)

  const result: ClickedLink[] = Array.from(byLink.entries())
    .map(([id, stats]) => {
      const info = urlMap.get(id)
      const topSrcCount = Math.max(
        stats.email, stats.search, stats.social, stats.referral, stats.direct, stats.other
      )
      const topSrcMap: Record<number, string> = {
        [stats.email]: 'Email',
        [stats.search]: 'Search',
        [stats.social]: 'Social',
        [stats.referral]: 'Referral',
        [stats.direct]: 'Direct',
        [stats.other]: 'Other',
      }
      return {
        url: info?.url ?? '',
        title: info?.title ?? null,
        type: classifyLink(info?.url ?? '', siteOrigin),
        clicks: stats.clicks,
        topSource: topSrcCount > 0 ? topSrcMap[topSrcCount] ?? null : null,
        shareOfTotal: total > 0 ? stats.clicks / total : 0,
      }
    })
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)

  return result
}

export async function fetchClicksDestination(period: PeriodInput, siteOrigin: string): Promise<ClicksDestination> {
  const topLinks = await fetchTopLinks(period, siteOrigin)
  const dest: ClicksDestination = { internal: 0, external: 0, youtube: 0, affiliate: 0, total: 0 }
  for (const l of topLinks) {
    dest.total += l.clicks
    if (l.url.includes('youtube.com') || l.url.includes('youtu.be')) {
      dest.youtube += l.clicks
    } else if (l.type === 'internal') {
      dest.internal += l.clicks
    } else {
      dest.external += l.clicks
    }
  }
  return dest
}

export async function fetchClicksSource(period: PeriodInput): Promise<ClicksSource> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)

  const { data } = await supabase
    .from('link_daily_metrics')
    .select('ref_direct, ref_search, ref_social, ref_email, ref_referral, ref_other')
    .eq('site_id', siteId)
    .gte('date', toDateStringInTz(start, await getSiteContext().then((c) => c.timezone)))
    .lte('date', toDateStringInTz(end, await getSiteContext().then((c) => c.timezone)))

  const rows = data ?? []
  return {
    blog: rows.reduce((s, r) => s + r.ref_referral, 0),
    newsletter: rows.reduce((s, r) => s + r.ref_email, 0),
    video: 0,  // YouTube referral tracked separately via utm_source
    social: rows.reduce((s, r) => s + r.ref_social, 0),
    other: rows.reduce((s, r) => s + r.ref_direct + r.ref_search + r.ref_other, 0),
  }
}

export async function fetchClicksChart(period: PeriodInput): Promise<ClicksChartPoint[]> {
  const { siteId, timezone } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(period)
  const prev = resolvePrevRange(period)

  const [curr, prevRes] = await Promise.all([
    supabase
      .from('link_daily_metrics')
      .select('date, clicks')
      .eq('site_id', siteId)
      .gte('date', toDateStringInTz(start, timezone))
      .lte('date', toDateStringInTz(end, timezone))
      .order('date', { ascending: true }),
    prev
      ? supabase
          .from('link_daily_metrics')
          .select('date, clicks')
          .eq('site_id', siteId)
          .gte('date', toDateStringInTz(prev.start, timezone))
          .lte('date', toDateStringInTz(prev.end, timezone))
          .order('date', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  const currData = curr.data ?? []
  const prevData = (prevRes as { data: { date: string; clicks: number }[] | null }).data ?? []

  const totalClicks = currData.reduce((s, r) => s + r.clicks, 0)
  const avgClicks = currData.length > 0 ? Math.round(totalClicks / currData.length) : 0

  return currData.map((row, i) => ({
    date: row.date,
    clicks: row.clicks,
    prevClicks: prevData[i]?.clicks ?? 0,
    avg: avgClicks,
  }))
}
```

- [ ] **Step 3: Add path alias for analytics lib to tsconfig**

In `apps/web/tsconfig.json`, add to `"paths"`:
```json
"@/lib/analytics/*": ["./lib/analytics/*"]
```

- [ ] **Step 4: Write smoke tests for queries**

```ts
// apps/web/test/lib/analytics/analytics-queries.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {}
      chain.select = vi.fn().mockReturnValue(chain)
      chain.eq = vi.fn().mockReturnValue(chain)
      chain.gte = vi.fn().mockReturnValue(chain)
      chain.lte = vi.fn().mockReturnValue(chain)
      chain.in = vi.fn().mockReturnValue(chain)
      chain.order = vi.fn().mockReturnValue(chain)
      chain.filter = vi.fn().mockReturnValue(chain)
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null, count: 0 })
      return chain
    }),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
  }),
}))

vi.mock('@/lib/cms/format-site-datetime', () => ({
  toDateStringInTz: vi.fn((date: Date) => date.toISOString().slice(0, 10)),
}))

describe('fetchKpiData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns KpiData shape with zero data', async () => {
    const { fetchKpiData } = await import('@/lib/analytics/analytics-queries')
    const result = await fetchKpiData({ type: 'preset', value: '30d' })
    expect(result).toHaveProperty('totalViews')
    expect(result).toHaveProperty('uniqueVisitors')
    expect(result).toHaveProperty('linkClicks')
    expect(result).toHaveProperty('viewsSparkline')
    expect(Array.isArray(result.viewsSparkline)).toBe(true)
  })
})

describe('fetchFunnelData', () => {
  it('returns FunnelData shape', async () => {
    const { fetchFunnelData } = await import('@/lib/analytics/analytics-queries')
    const result = await fetchFunnelData({ type: 'preset', value: '7d' })
    expect(result).toHaveProperty('views')
    expect(result).toHaveProperty('read50')
    expect(result).toHaveProperty('clickedLink')
    expect(result).toHaveProperty('nlOpened')
    expect(result).toHaveProperty('subscribed')
  })
})
```

---

### Task 12: KPI Row + Sparkline Components

**Files:**
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/kpi-row.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/sparkline.tsx`
- Test: `apps/web/test/cms/analytics-kpi-row.test.tsx`

- [ ] **Step 1: Create `sparkline.tsx` — pure SVG inline sparkline, no external lib**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/sparkline.tsx

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
}

export function Sparkline({ data, width = 64, height = 24, color = '#FF8240' }: SparklineProps) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const step = width / (data.length - 1)
  const points = data
    .map((v, i) => `${i * step},${height - (v / max) * (height - 2) - 1}`)
    .join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <polyline
        points={points}
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
    </svg>
  )
}
```

- [ ] **Step 2: Create `kpi-row.tsx` — 6 KPI cards with trend arrow + sparkline**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/kpi-row.tsx

import { Sparkline } from './sparkline'
import type { KpiData } from '../types'

interface KpiCardProps {
  label: string
  value: number
  prev: number | null
  format?: 'number' | 'percent' | 'depth'
  sparkline?: number[]
  color?: string
}

function fmt(value: number, format: KpiCardProps['format']): string {
  if (format === 'percent') return `${value}%`
  if (format === 'depth') return `${value}%`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

function TrendArrow({ value, prev }: { value: number; prev: number | null }) {
  if (prev === null || prev === 0) return null
  const delta = ((value - prev) / prev) * 100
  const up = delta > 0
  const neutral = Math.abs(delta) < 1
  if (neutral) return null
  return (
    <span
      className="flex items-center gap-0.5 text-xs font-medium"
      style={{ color: up ? 'var(--color-success, #4ade80)' : 'var(--color-danger, #f87171)' }}
    >
      {up ? '↑' : '↓'}
      {Math.abs(Math.round(delta))}%
    </span>
  )
}

function KpiCard({ label, value, prev, format = 'number', sparkline, color }: KpiCardProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-4"
      style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border)' }}
    >
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--cms-text-muted)' }}>
        {label}
      </span>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--cms-text)' }}>
          {fmt(value, format)}
        </span>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={color ?? 'var(--cms-accent)'} />
        )}
      </div>
      <TrendArrow value={value} prev={prev} />
    </div>
  )
}

interface KpiRowProps {
  data: KpiData
}

export function KpiRow({ data }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        label="Total Views"
        value={data.totalViews}
        prev={data.prevTotalViews}
        sparkline={data.viewsSparkline}
        color="#FF8240"
      />
      <KpiCard
        label="Link Clicks"
        value={data.linkClicks}
        prev={data.prevLinkClicks}
        sparkline={data.clicksSparkline}
        color="#60a5fa"
      />
      <KpiCard
        label="Avg Read Depth"
        value={data.avgReadDepth}
        prev={data.prevAvgReadDepth}
        format="depth"
      />
      <KpiCard
        label="NL Open Rate"
        value={data.nlOpenRate}
        prev={data.prevNlOpenRate}
        format="percent"
      />
      <KpiCard
        label="Subscribers"
        value={data.subscribers}
        prev={data.prevSubscribers}
      />
      <KpiCard
        label="Unique Visitors"
        value={data.uniqueVisitors}
        prev={data.prevUniqueVisitors}
      />
    </div>
  )
}
```

- [ ] **Step 3: Write tests**

```tsx
// apps/web/test/cms/analytics-kpi-row.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiRow } from '@/app/cms/(authed)/analytics/_components/kpi-row'
import type { KpiData } from '@/app/cms/(authed)/analytics/types'

const base: KpiData = {
  totalViews: 12500,
  uniqueVisitors: 8300,
  linkClicks: 420,
  avgReadDepth: 61,
  nlOpenRate: 42,
  subscribers: 1200,
  prevTotalViews: 10000,
  prevUniqueVisitors: null,
  prevLinkClicks: 380,
  prevAvgReadDepth: null,
  prevNlOpenRate: null,
  prevSubscribers: null,
  viewsSparkline: [100, 120, 90, 110, 130, 150, 140],
  clicksSparkline: [10, 12, 8, 14, 16, 20, 18],
}

describe('KpiRow', () => {
  it('renders 6 KPI cards', () => {
    render(<KpiRow data={base} />)
    expect(screen.getByText('Total Views')).toBeDefined()
    expect(screen.getByText('Link Clicks')).toBeDefined()
    expect(screen.getByText('Avg Read Depth')).toBeDefined()
    expect(screen.getByText('NL Open Rate')).toBeDefined()
    expect(screen.getByText('Subscribers')).toBeDefined()
    expect(screen.getByText('Unique Visitors')).toBeDefined()
  })

  it('formats large numbers with k suffix', () => {
    render(<KpiRow data={base} />)
    expect(screen.getByText('12.5k')).toBeDefined()
  })

  it('formats percentages with % suffix', () => {
    render(<KpiRow data={base} />)
    expect(screen.getByText('42%')).toBeDefined()
  })

  it('shows trend arrow for values with prev', () => {
    render(<KpiRow data={base} />)
    // 12500 vs 10000 → +25% ↑
    expect(screen.getByText('25%').closest('span')?.textContent).toContain('↑')
  })
})
```

---

### Task 13: Content Funnel Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/content-funnel.tsx`
- Test: `apps/web/test/cms/analytics-content-funnel.test.tsx`

- [ ] **Step 1: Create `content-funnel.tsx` — proportional flex-based 5-stage funnel**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/content-funnel.tsx

import type { FunnelData } from '../types'

const STAGES = [
  { key: 'views',       label: 'Views',           flex: 2.5, color: '#FF8240' },
  { key: 'read50',      label: 'Read 50%+',        flex: 1.8, color: '#f59e0b' },
  { key: 'clickedLink', label: 'Clicked Link',     flex: 1.2, color: '#60a5fa' },
  { key: 'nlOpened',   label: 'NL Opened',         flex: 0.8, color: '#a78bfa' },
  { key: 'subscribed',  label: 'Subscribed',       flex: 0.5, color: '#34d399' },
] as const

function fmtN(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

interface FunnelStageProps {
  label: string
  value: number
  prevValue: number
  flex: number
  color: string
  dropPct: number | null
}

function FunnelStage({ label, value, flex, color, dropPct }: FunnelStageProps) {
  return (
    <div className="flex flex-col items-start gap-1" style={{ flex }}>
      <div
        className="w-full rounded-lg px-3 py-2 text-center"
        style={{ background: color + '22', border: `1px solid ${color}44` }}
      >
        <div className="text-lg font-semibold tabular-nums" style={{ color }}>
          {fmtN(value)}
        </div>
        <div className="text-xs" style={{ color: 'var(--cms-text-muted)' }}>
          {label}
        </div>
      </div>
      {dropPct !== null && (
        <div
          className="w-full text-center text-xs"
          style={{ color: dropPct > 60 ? 'var(--color-danger, #f87171)' : 'var(--cms-text-muted)' }}
        >
          ↓ {dropPct}% drop-off
        </div>
      )}
    </div>
  )
}

interface ContentFunnelProps {
  data: FunnelData
}

export function ContentFunnel({ data }: ContentFunnelProps) {
  const values: number[] = [
    data.views,
    data.read50,
    data.clickedLink,
    data.nlOpened,
    data.subscribed,
  ]

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border)' }}
    >
      <h3 className="mb-4 text-sm font-semibold" style={{ color: 'var(--cms-text)' }}>
        Content Funnel
      </h3>
      <div className="flex items-start gap-2">
        {STAGES.map((stage, i) => {
          const prev = values[i - 1] ?? values[0]
          const dropPct = i > 0 && prev > 0
            ? Math.round(((prev - values[i]) / prev) * 100)
            : null
          return (
            <FunnelStage
              key={stage.key}
              label={stage.label}
              value={values[i]}
              prevValue={prev}
              flex={stage.flex}
              color={stage.color}
              dropPct={dropPct}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write tests**

```tsx
// apps/web/test/cms/analytics-content-funnel.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContentFunnel } from '@/app/cms/(authed)/analytics/_components/content-funnel'

describe('ContentFunnel', () => {
  const data = { views: 1000, read50: 400, clickedLink: 80, nlOpened: 30, subscribed: 5 }

  it('renders all 5 stage labels', () => {
    render(<ContentFunnel data={data} />)
    expect(screen.getByText('Views')).toBeDefined()
    expect(screen.getByText('Read 50%+')).toBeDefined()
    expect(screen.getByText('Clicked Link')).toBeDefined()
    expect(screen.getByText('NL Opened')).toBeDefined()
    expect(screen.getByText('Subscribed')).toBeDefined()
  })

  it('shows drop-off % annotations', () => {
    render(<ContentFunnel data={data} />)
    // 1000 → 400 = 60% drop
    expect(screen.getByText('↓ 60% drop-off')).toBeDefined()
  })

  it('renders 1k for values >= 1000', () => {
    render(<ContentFunnel data={data} />)
    expect(screen.getByText('1k')).toBeDefined()
  })
})
```

---

### Task 14: Top Links Table + Destination/Source Panels

**Files:**
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/top-links-table.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/clicks-destination.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/clicks-source.tsx`
- Test: `apps/web/test/cms/analytics-links-panels.test.tsx`

- [ ] **Step 1: Create `top-links-table.tsx`**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/top-links-table.tsx

import { linkTypeBadgeColor, linkTypeLabel } from '@/lib/analytics/link-classifier'
import type { ClickedLink } from '../types'

interface TopLinksTableProps {
  links: ClickedLink[]
}

export function TopLinksTable({ links }: TopLinksTableProps) {
  if (links.length === 0) {
    return (
      <div
        className="rounded-xl p-4 text-center text-sm"
        style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border)', color: 'var(--cms-text-muted)' }}
      >
        No link data for this period
      </div>
    )
  }

  const maxClicks = links[0]?.clicks ?? 1

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border)' }}
    >
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--cms-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--cms-text)' }}>
          Top Clicked Links
        </h3>
      </div>
      <div className="divide-y" style={{ '--tw-divide-opacity': 1, borderColor: 'var(--cms-border)' } as React.CSSProperties}>
        {links.map((link, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            {/* Link + type badge */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
                  style={{
                    background: linkTypeBadgeColor(link.type) + '22',
                    color: linkTypeBadgeColor(link.type),
                  }}
                >
                  {linkTypeLabel(link.type)}
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm hover:underline"
                  style={{ color: 'var(--cms-text)' }}
                  title={link.url}
                >
                  {link.title ?? link.url}
                </a>
              </div>
              {link.topSource && (
                <div className="mt-0.5 text-xs" style={{ color: 'var(--cms-text-muted)' }}>
                  Top source: {link.topSource}
                </div>
              )}
            </div>
            {/* Clicks + share bar */}
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--cms-text)' }}>
                {link.clicks}
              </span>
              <div
                className="h-1 w-16 overflow-hidden rounded-full"
                style={{ background: 'var(--cms-border)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(link.clicks / maxClicks) * 100}%`,
                    background: linkTypeBadgeColor(link.type),
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `clicks-destination.tsx` — 2×2 grid**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/clicks-destination.tsx

import type { ClicksDestination } from '../types'

interface ClicksDestinationProps {
  data: ClicksDestination
}

const CELLS = [
  { key: 'internal' as const, label: 'In-house', color: '#60a5fa' },
  { key: 'external' as const, label: 'External', color: '#38bdf8' },
  { key: 'youtube' as const, label: 'YouTube', color: '#f87171' },
  { key: 'affiliate' as const, label: 'Affiliate', color: '#fbbf24' },
]

export function ClicksDestinationPanel({ data }: ClicksDestinationProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border)' }}
    >
      <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--cms-text)' }}>
        Where Clicks Go
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {CELLS.map((cell) => {
          const count = data[cell.key]
          const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0
          return (
            <div
              key={cell.key}
              className="flex flex-col gap-0.5 rounded-lg p-3"
              style={{ background: cell.color + '11', border: `1px solid ${cell.color}33` }}
            >
              <span className="text-xs" style={{ color: 'var(--cms-text-muted)' }}>{cell.label}</span>
              <span className="text-xl font-semibold tabular-nums" style={{ color: cell.color }}>
                {count}
              </span>
              <span className="text-xs" style={{ color: 'var(--cms-text-muted)' }}>{pct}% of total</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `clicks-source.tsx` — vertical list with colored borders**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/clicks-source.tsx

import type { ClicksSource } from '../types'

const SOURCES = [
  { key: 'blog' as const,       label: 'Blog',       color: '#34d399' },
  { key: 'newsletter' as const, label: 'Newsletter',  color: '#a78bfa' },
  { key: 'video' as const,      label: 'Video',       color: '#f87171' },
  { key: 'social' as const,     label: 'Social',      color: '#818cf8' },
  { key: 'other' as const,      label: 'Other',       color: 'var(--cms-text-muted)' },
]

interface ClicksSourceProps {
  data: ClicksSource
}

export function ClicksSourcePanel({ data }: ClicksSourceProps) {
  const total = Object.values(data).reduce((s, v) => s + v, 0)

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border)' }}
    >
      <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--cms-text)' }}>
        Where Clicks Come From
      </h3>
      <div className="flex flex-col gap-2">
        {SOURCES.map((src) => {
          const count = data[src.key]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div
              key={src.key}
              className="flex items-center gap-3 rounded-lg py-1.5 pl-3 pr-3"
              style={{ borderLeft: `3px solid ${src.color}`, background: src.color + '11' }}
            >
              <span className="flex-1 text-sm" style={{ color: 'var(--cms-text)' }}>{src.label}</span>
              <span className="text-sm font-medium tabular-nums" style={{ color: src.color }}>
                {count}
              </span>
              <span className="w-10 text-right text-xs" style={{ color: 'var(--cms-text-muted)' }}>
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write tests**

```tsx
// apps/web/test/cms/analytics-links-panels.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopLinksTable } from '@/app/cms/(authed)/analytics/_components/top-links-table'
import { ClicksDestinationPanel } from '@/app/cms/(authed)/analytics/_components/clicks-destination'
import { ClicksSourcePanel } from '@/app/cms/(authed)/analytics/_components/clicks-source'

describe('TopLinksTable', () => {
  it('renders empty state when no links', () => {
    render(<TopLinksTable links={[]} />)
    expect(screen.getByText('No link data for this period')).toBeDefined()
  })

  it('renders link rows with type badge', () => {
    render(<TopLinksTable links={[
      { url: 'https://youtube.com', title: 'My Video', type: 'external', clicks: 120, topSource: 'Blog', shareOfTotal: 0.6 },
    ]} />)
    expect(screen.getByText('My Video')).toBeDefined()
    expect(screen.getByText('External')).toBeDefined()
    expect(screen.getByText('120')).toBeDefined()
  })
})

describe('ClicksDestinationPanel', () => {
  it('renders all 4 destination cells', () => {
    render(<ClicksDestinationPanel data={{ internal: 50, external: 30, youtube: 20, affiliate: 5, total: 105 }} />)
    expect(screen.getByText('In-house')).toBeDefined()
    expect(screen.getByText('YouTube')).toBeDefined()
    expect(screen.getByText('Affiliate')).toBeDefined()
  })
})

describe('ClicksSourcePanel', () => {
  it('renders all source rows', () => {
    render(<ClicksSourcePanel data={{ blog: 80, newsletter: 40, video: 10, social: 20, other: 5 }} />)
    expect(screen.getByText('Blog')).toBeDefined()
    expect(screen.getByText('Newsletter')).toBeDefined()
    expect(screen.getByText('Social')).toBeDefined()
  })
})
```

---

### Task 15: Clicks Chart (pure CSS/SVG bar chart)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/clicks-chart.tsx`
- Test: `apps/web/test/cms/analytics-clicks-chart.test.tsx`

- [ ] **Step 1: Create `clicks-chart.tsx` — SVG bar chart, ghost bars, dashed avg line, tooltip**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/clicks-chart.tsx
'use client'

import { useState } from 'react'
import type { ClicksChartPoint } from '../types'

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

function fmtN(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

interface ClicksChartProps {
  data: ClicksChartPoint[]
}

const CHART_H = 160
const BAR_GAP = 4

export function ClicksChart({ data }: ClicksChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div
        className="flex h-44 items-center justify-center rounded-xl text-sm"
        style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border)', color: 'var(--cms-text-muted)' }}
      >
        No click data for this period
      </div>
    )
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.clicks, d.prevClicks)), 1)
  const avg = data[0]?.avg ?? 0

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border)' }}
    >
      <div className="px-4 pt-3 pb-1">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--cms-text)' }}>Clicks Over Time</h3>
        <div className="mt-1 flex items-center gap-4 text-xs" style={{ color: 'var(--cms-text-muted)' }}>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: '#60a5fa' }} /> This period
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: '#60a5fa26' }} /> Prev period
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 border-t border-dashed" style={{ borderColor: '#f59e0b' }} /> Avg ({fmtN(avg)})
          </span>
        </div>
      </div>
      <div className="relative px-4 pb-4 pt-2">
        <svg
          width="100%"
          height={CHART_H + 24}
          viewBox={`0 0 ${data.length * 20} ${CHART_H + 24}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {/* Y-axis gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={data.length * 20}
              y1={CHART_H - f * CHART_H}
              y2={CHART_H - f * CHART_H}
              stroke="var(--cms-border)"
              strokeWidth={0.5}
            />
          ))}
          {/* Dashed average line */}
          {avg > 0 && (
            <line
              x1={0}
              x2={data.length * 20}
              y1={CHART_H - (avg / maxVal) * CHART_H}
              y2={CHART_H - (avg / maxVal) * CHART_H}
              stroke="#f59e0b"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}
          {/* Bars */}
          {data.map((point, i) => {
            const barW = 20 - BAR_GAP
            const x = i * 20 + BAR_GAP / 2
            const currH = (point.clicks / maxVal) * CHART_H
            const prevH = (point.prevClicks / maxVal) * CHART_H
            const isHovered = hover === i
            return (
              <g key={i}>
                {/* Ghost bar (prev period) */}
                <rect
                  x={x}
                  y={CHART_H - prevH}
                  width={barW}
                  height={prevH}
                  fill="#60a5fa"
                  opacity={0.15}
                  rx={2}
                />
                {/* Current bar */}
                <rect
                  x={x}
                  y={CHART_H - currH}
                  width={barW}
                  height={currH}
                  fill={isHovered ? '#3b82f6' : '#60a5fa'}
                  opacity={isHovered ? 1 : 0.8}
                  rx={2}
                />
                {/* Hit area */}
                <rect
                  x={x}
                  y={0}
                  width={barW}
                  height={CHART_H}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'default' }}
                />
                {/* X-axis label (every 4th) */}
                {i % 4 === 0 && (
                  <text
                    x={x + barW / 2}
                    y={CHART_H + 16}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--cms-text-muted)"
                  >
                    {formatDate(point.date)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {/* Tooltip */}
        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute rounded-lg px-2.5 py-1.5 text-xs shadow-md"
            style={{
              background: 'var(--cms-surface)',
              border: '1px solid var(--cms-border)',
              color: 'var(--cms-text)',
              top: 8,
              left: `${Math.min((hover / data.length) * 100, 70)}%`,
            }}
          >
            <div className="font-medium">{data[hover]?.date}</div>
            <div>Clicks: <strong>{data[hover]?.clicks}</strong></div>
            {(data[hover]?.prevClicks ?? 0) > 0 && (
              <div style={{ color: 'var(--cms-text-muted)' }}>Prev: {data[hover]?.prevClicks}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write tests**

```tsx
// apps/web/test/cms/analytics-clicks-chart.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClicksChart } from '@/app/cms/(authed)/analytics/_components/clicks-chart'

describe('ClicksChart', () => {
  it('shows empty state when no data', () => {
    render(<ClicksChart data={[]} />)
    expect(screen.getByText('No click data for this period')).toBeDefined()
  })

  it('renders the heading when data present', () => {
    render(<ClicksChart data={[
      { date: '2026-05-01', clicks: 50, prevClicks: 40, avg: 45 },
      { date: '2026-05-02', clicks: 60, prevClicks: 55, avg: 45 },
    ]} />)
    expect(screen.getByText('Clicks Over Time')).toBeDefined()
  })
})
```

---

### Task 16: Insights Strip

**Files:**
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/insights-strip.tsx`
- Test: `apps/web/test/cms/analytics-insights-strip.test.tsx`

- [ ] **Step 1: Create `insights-strip.tsx`**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/insights-strip.tsx

import type { InsightCard } from '@/lib/analytics/insights-engine'

const KIND_ICON: Record<InsightCard['kind'], string> = {
  leak: '⚠',
  win: '✓',
  opportunity: '→',
}

interface InsightsStripProps {
  cards: InsightCard[]
}

export function InsightsStrip({ cards }: InsightsStripProps) {
  if (cards.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="rounded-xl p-4"
          style={{
            background: card.color + '11',
            border: `1px solid ${card.color}33`,
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: card.color + '33', color: card.color }}
            >
              {KIND_ICON[card.kind]}
            </span>
            <span className="text-sm font-semibold" style={{ color: card.color }}>
              {card.title}
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--cms-text-muted)' }}>
            {card.body}
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write tests**

```tsx
// apps/web/test/cms/analytics-insights-strip.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InsightsStrip } from '@/app/cms/(authed)/analytics/_components/insights-strip'

describe('InsightsStrip', () => {
  it('renders nothing when no cards', () => {
    const { container } = render(<InsightsStrip cards={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders card title and body', () => {
    render(<InsightsStrip cards={[
      { kind: 'leak', title: 'Biggest Leak', body: 'Views → Read 50%+: 60% lost', color: '#f87171' },
    ]} />)
    expect(screen.getByText('Biggest Leak')).toBeDefined()
    expect(screen.getByText('Views → Read 50%+: 60% lost')).toBeDefined()
  })

  it('renders at most 3 cards', () => {
    const cards = Array.from({ length: 3 }, (_, i) => ({
      kind: 'win' as const,
      title: `Win ${i}`,
      body: 'body',
      color: '#4ade80',
    }))
    render(<InsightsStrip cards={cards} />)
    expect(screen.getAllByText(/^Win /)).toHaveLength(3)
  })
})
```

---

### Task 17: Analytics Overview Tab + Header + Page Wiring

**Files:**
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/analytics-header.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/_components/analytics-overview.tsx`
- Modify: `apps/web/src/app/cms/(authed)/analytics/page.tsx`
- Test: `apps/web/test/cms/analytics-overview.test.tsx`

- [ ] **Step 1: Create `analytics-header.tsx` — sticky header with 5 tabs + period selector**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/analytics-header.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'content',   label: 'Content' },
  { id: 'links',     label: 'Links' },
  { id: 'audience',  label: 'Audience' },
  { id: 'revenue',   label: 'Revenue' },
] as const

type TabId = typeof TABS[number]['id']

const PERIODS = ['7d', '30d', '90d'] as const
type PeriodPreset = typeof PERIODS[number]

interface AnalyticsHeaderProps {
  activeTab: TabId
  activePeriod: string
}

export function AnalyticsHeader({ activeTab, activePeriod }: AnalyticsHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const navigate = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(patch)) params.set(k, v)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, sp],
  )

  return (
    <div
      className="sticky top-0 z-10 flex flex-col gap-3 border-b pb-3 pt-4 backdrop-blur-sm"
      style={{ background: 'var(--cms-bg)', borderColor: 'var(--cms-border)' }}
    >
      <div className="flex items-center justify-between gap-4 px-4">
        <h1 className="text-base font-semibold" style={{ color: 'var(--cms-text)' }}>Analytics</h1>
        {/* Period selector */}
        <div
          className="flex items-center rounded-lg p-0.5"
          style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border)' }}
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => navigate({ period: p, tab: activeTab })}
              className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
              style={{
                background: activePeriod === p ? 'var(--cms-accent)' : 'transparent',
                color: activePeriod === p ? '#fff' : 'var(--cms-text-muted)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate({ tab: tab.id, period: activePeriod })}
            className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              background: activeTab === tab.id ? 'var(--cms-accent)22' : 'transparent',
              color: activeTab === tab.id ? 'var(--cms-accent)' : 'var(--cms-text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--cms-accent)' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `analytics-overview.tsx` — RSC default tab, assembles all overview panels**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/analytics-overview.tsx

import { KpiRow } from './kpi-row'
import { ContentFunnel } from './content-funnel'
import { TopLinksTable } from './top-links-table'
import { ClicksDestinationPanel } from './clicks-destination'
import { ClicksSourcePanel } from './clicks-source'
import { ClicksChart } from './clicks-chart'
import { InsightsStrip } from './insights-strip'
import {
  fetchKpiData,
  fetchFunnelData,
  fetchTopLinks,
  fetchClicksDestination,
  fetchClicksSource,
  fetchClicksChart,
} from '@/lib/analytics/analytics-queries'
import { generateInsights } from '@/lib/analytics/insights-engine'
import type { PeriodInput } from '../types'

interface AnalyticsOverviewProps {
  period: PeriodInput
  siteOrigin: string
}

export async function AnalyticsOverview({ period, siteOrigin }: AnalyticsOverviewProps) {
  const [kpi, funnel, topLinks, destination, source, chart] = await Promise.all([
    fetchKpiData(period),
    fetchFunnelData(period),
    fetchTopLinks(period, siteOrigin),
    fetchClicksDestination(period, siteOrigin),
    fetchClicksSource(period),
    fetchClicksChart(period),
  ])

  const insightCards = generateInsights(funnel, {
    totalClicks: kpi.linkClicks,
    prevTotalClicks: kpi.prevLinkClicks ?? 0,
    topSource: source.blog >= source.newsletter ? 'Blog' : 'Newsletter',
    topSourceClicks: Math.max(source.blog, source.newsletter),
  })

  return (
    <div className="flex flex-col gap-6 p-4">
      <KpiRow data={kpi} />
      <ContentFunnel data={funnel} />
      <TopLinksTable links={topLinks} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ClicksDestinationPanel data={destination} />
        <ClicksSourcePanel data={source} />
      </div>
      <ClicksChart data={chart} />
      <InsightsStrip cards={insightCards} />
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `page.tsx` — simplified RSC, renders header + overview, lazy other tabs**

```tsx
// apps/web/src/app/cms/(authed)/analytics/page.tsx
import { Suspense, lazy } from 'react'
import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { AnalyticsHeader } from './_components/analytics-header'
import { AnalyticsOverview } from './_components/analytics-overview'
import type { PeriodInput } from './types'

// Lazy-loaded tabs (client components with Suspense)
const AnalyticsContent  = lazy(() => import('./_components/analytics-content').then((m) => ({ default: m.AnalyticsContent })))
const AnalyticsLinks    = lazy(() => import('./_components/analytics-links').then((m) => ({ default: m.AnalyticsLinks })))
const AnalyticsAudience = lazy(() => import('./_components/analytics-audience').then((m) => ({ default: m.AnalyticsAudience })))
const AnalyticsRevenue  = lazy(() => import('./_components/analytics-revenue').then((m) => ({ default: m.AnalyticsRevenue })))

interface Props {
  searchParams: Promise<{
    tab?: string
    period?: string
    start?: string
    end?: string
  }>
}

function TabSkeleton() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div
        className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: 'var(--cms-accent)', borderTopColor: 'transparent' }}
      />
    </div>
  )
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const tab = (params.tab ?? 'overview') as 'overview' | 'content' | 'links' | 'audience' | 'revenue'
  const periodValue = params.period ?? '30d'

  let periodInput: PeriodInput
  if (periodValue === 'custom' && params.start && params.end) {
    periodInput = { type: 'custom', start: params.start, end: params.end }
  } else {
    const preset = periodValue === '7d' || periodValue === '90d' ? periodValue : '30d'
    periodInput = { type: 'preset', value: preset }
  }

  const siteOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <AnalyticsHeader activeTab={tab} activePeriod={periodValue} />
      {tab === 'overview' && (
        <Suspense fallback={<TabSkeleton />}>
          <AnalyticsOverview period={periodInput} siteOrigin={siteOrigin} />
        </Suspense>
      )}
      {tab === 'content' && (
        <Suspense fallback={<TabSkeleton />}>
          <AnalyticsContent period={periodInput} />
        </Suspense>
      )}
      {tab === 'links' && (
        <Suspense fallback={<TabSkeleton />}>
          <AnalyticsLinks period={periodInput} />
        </Suspense>
      )}
      {tab === 'audience' && (
        <Suspense fallback={<TabSkeleton />}>
          <AnalyticsAudience period={periodInput} />
        </Suspense>
      )}
      {tab === 'revenue' && (
        <Suspense fallback={<TabSkeleton />}>
          <AnalyticsRevenue period={periodInput} />
        </Suspense>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create stub files for lazy tabs (not implemented yet)**

```tsx
// apps/web/src/app/cms/(authed)/analytics/_components/analytics-content.tsx
import type { PeriodInput } from '../types'
export function AnalyticsContent({ period }: { period: PeriodInput }) {
  return <div className="p-4 text-sm" style={{ color: 'var(--cms-text-muted)' }}>Content analytics — coming soon</div>
}

// apps/web/src/app/cms/(authed)/analytics/_components/analytics-links.tsx
import type { PeriodInput } from '../types'
export function AnalyticsLinks({ period }: { period: PeriodInput }) {
  return <div className="p-4 text-sm" style={{ color: 'var(--cms-text-muted)' }}>Links analytics — coming soon</div>
}

// apps/web/src/app/cms/(authed)/analytics/_components/analytics-audience.tsx
import type { PeriodInput } from '../types'
export function AnalyticsAudience({ period }: { period: PeriodInput }) {
  return <div className="p-4 text-sm" style={{ color: 'var(--cms-text-muted)' }}>Audience analytics — coming soon</div>
}

// apps/web/src/app/cms/(authed)/analytics/_components/analytics-revenue.tsx
import type { PeriodInput } from '../types'
export function AnalyticsRevenue({ period }: { period: PeriodInput }) {
  return <div className="p-4 text-sm" style={{ color: 'var(--cms-text-muted)' }}>Revenue analytics — coming soon</div>
}
```

- [ ] **Step 5: Write smoke test for page**

```tsx
// apps/web/test/cms/analytics-overview.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/cms/analytics',
  useSearchParams: () => new URLSearchParams(),
}))

import { AnalyticsHeader } from '@/app/cms/(authed)/analytics/_components/analytics-header'

describe('AnalyticsHeader', () => {
  it('renders all 5 tabs', () => {
    render(<AnalyticsHeader activeTab="overview" activePeriod="30d" />)
    expect(screen.getByText('Overview')).toBeDefined()
    expect(screen.getByText('Content')).toBeDefined()
    expect(screen.getByText('Links')).toBeDefined()
    expect(screen.getByText('Audience')).toBeDefined()
    expect(screen.getByText('Revenue')).toBeDefined()
  })

  it('renders period buttons', () => {
    render(<AnalyticsHeader activeTab="overview" activePeriod="30d" />)
    expect(screen.getByText('7d')).toBeDefined()
    expect(screen.getByText('30d')).toBeDefined()
    expect(screen.getByText('90d')).toBeDefined()
  })
})
```

---

### Task 18: In-Content Link Tracking

**Files:**
- Modify: `apps/web/lib/tracking/events.ts`
- Modify: `apps/web/src/app/api/track/content/route.ts`
- Modify: `apps/web/src/components/blog/blog-article-html.tsx`
- Create: `apps/web/lib/tracking/use-link-tracking.ts`
- Test: `apps/web/test/lib/tracking/use-link-tracking.test.ts`

- [ ] **Step 1: Extend `events.ts` — add `link_click` event type + new fields**

Add to the `EventType` enum and schema in `apps/web/lib/tracking/events.ts`:
```ts
// Replace EventType line:
export const EventType = z.enum(['view', 'read_progress', 'read_complete', 'link_click'])

// Add to TrackingEventSchema (all optional to stay backward-compatible):
destUrl: z.string().url().optional(),
linkType: z.enum(['internal', 'external', 'shortlink']).optional(),
```

- [ ] **Step 2: Extend DB route to accept new fields**

In `apps/web/src/app/api/track/content/route.ts`, add to the rows mapping:
```ts
dest_url: e.destUrl ?? null,
link_type: e.linkType ?? null,
```

Note: The `content_events` table needs these columns — added in Task 19 migration. The route should silently ignore them if the column does not exist yet (Supabase will error; wrap insert in try/catch or wait for migration to run first).

- [ ] **Step 3: Create `use-link-tracking.ts` — intercept .prose anchor clicks, dedup 5s**

```ts
// apps/web/lib/tracking/use-link-tracking.ts
'use client'

import { useEffect, useRef } from 'react'
import { useCookieConsent } from '@/components/lgpd/cookie-banner-context'
import { classifyLink } from '@/lib/analytics/link-classifier'
import type { TrackingConfig } from './events'

const TRACK_URL = '/api/track/content'
const DEDUP_MS = 5_000

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

interface UseLinkTrackingConfig {
  trackingConfig: TrackingConfig
  proseRef: React.RefObject<HTMLElement | null>
  sessionId: string
}

export function useLinkTracking({ trackingConfig, proseRef, sessionId }: UseLinkTrackingConfig): void {
  const { consent } = useCookieConsent()
  const lastClicks = useRef(new Map<string, number>())

  useEffect(() => {
    const el = proseRef.current
    if (!el) return

    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href) return

      // Dedup: same href within 5s
      const now = Date.now()
      const last = lastClicks.current.get(href) ?? 0
      if (now - last < DEDUP_MS) return
      lastClicks.current.set(href, now)

      const origin = window.location.origin
      const linkType = classifyLink(href, origin)
      const anonymousId =
        consent?.anonymousId ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('lgpd_anon_id') : null) ||
        generateSessionId()

      const payload = JSON.stringify({
        events: [{
          sessionId,
          siteId: trackingConfig.siteId,
          resourceType: trackingConfig.resourceType,
          resourceId: trackingConfig.resourceId,
          eventType: 'link_click',
          anonymousId,
          locale: trackingConfig.locale,
          hasConsent: consent?.analytics ?? false,
          destUrl: href.startsWith('http') ? href : `${origin}${href}`,
          linkType,
        }],
      })

      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(TRACK_URL, new Blob([payload], { type: 'application/json' }))
        } else {
          fetch(TRACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {})
        }
      } catch {
        // sendBeacon not available
      }
    }

    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [trackingConfig, consent, sessionId, proseRef])
}
```

- [ ] **Step 4: Wire into `blog-article-html.tsx` — add a ref + call `useLinkTracking`**

```tsx
// apps/web/src/components/blog/blog-article-html.tsx
'use client'

import DOMPurify from 'isomorphic-dompurify'
import { useEffect, useRef } from 'react'
import { EmbedHydrator } from './embed-hydrator'
import { useLinkTracking } from '@/lib/tracking/use-link-tracking'
import type { TrackingConfig } from '@/lib/tracking/events'

interface BlogArticleHtmlProps {
  html: string
  trackingConfig?: TrackingConfig
  sessionId?: string
}

export function BlogArticleHtml({ html, trackingConfig, sessionId }: BlogArticleHtmlProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bodyRef.current) return
    const hydrator = new EmbedHydrator(bodyRef.current)
    hydrator.hydrate()
    return () => hydrator.cleanup()
  }, [html])

  useLinkTracking({
    trackingConfig: trackingConfig ?? { siteId: '', resourceType: 'blog', resourceId: '', locale: 'pt-BR' },
    proseRef: bodyRef,
    sessionId: sessionId ?? '',
  })

  return <div ref={bodyRef} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
}
```

- [ ] **Step 5: Update callers of `BlogArticleHtml` to pass `trackingConfig` + `sessionId`**

In `apps/web/src/app/(public)/blog/[slug]/blog-article-client.tsx` — pass the existing config values from `useContentTracking` call down to `BlogArticleHtml`. The sessionId is already managed there via `useRef`.

- [ ] **Step 6: Write tests**

```ts
// apps/web/test/lib/tracking/use-link-tracking.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'

vi.mock('@/components/lgpd/cookie-banner-context', () => ({
  useCookieConsent: () => ({ consent: { analytics: false, anonymousId: 'anon-1' } }),
}))

vi.mock('@/lib/analytics/link-classifier', () => ({
  classifyLink: () => 'external',
}))

describe('useLinkTracking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('attaches click listener to element', () => {
    const div = document.createElement('div')
    const addSpy = vi.spyOn(div, 'addEventListener')
    const ref = { current: div }

    const { useLinkTracking } = await import('@/lib/tracking/use-link-tracking')
    renderHook(() =>
      useLinkTracking({
        trackingConfig: { siteId: 's1', resourceType: 'blog', resourceId: 'r1', locale: 'pt-BR' },
        proseRef: ref as React.RefObject<HTMLElement>,
        sessionId: 'sess-1',
      }),
    )
    expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function))
  })
})
```

---

### Task 19: DB Migration — subscriber source + content_events link columns

**Files:**
- Create: `supabase/migrations/<timestamp>_analytics_link_tracking.sql` (use `npm run db:new analytics_link_tracking`)

- [ ] **Step 1: Generate migration file**

```bash
npm run db:new analytics_link_tracking
```

- [ ] **Step 2: Edit the generated migration file**

```sql
-- Add subscriber source attribution
alter table public.newsletter_subscriptions
  add column if not exists source text default null;

comment on column public.newsletter_subscriptions.source is
  'Attribution source for the subscription (e.g. blog, newsletter, social, video, go/)';

-- Add link_click fields to content_events
alter table public.content_events
  add column if not exists dest_url text default null,
  add column if not exists link_type text default null;

-- Loosen the event_type check to allow link_click
alter table public.content_events
  drop constraint if exists content_events_event_type_check;

alter table public.content_events
  add constraint content_events_event_type_check
  check (event_type = any (array[
    'view'::text,
    'read_progress'::text,
    'read_complete'::text,
    'link_click'::text
  ]));

-- link_type check
alter table public.content_events
  add constraint content_events_link_type_check
  check (link_type is null or link_type = any (array[
    'internal'::text,
    'external'::text,
    'shortlink'::text
  ]));

-- Index for link click analytics queries
create index if not exists content_events_link_click_idx
  on public.content_events (site_id, event_type, created_at)
  where event_type = 'link_click';
```

- [ ] **Step 3: Push to prod**

```bash
npm run db:push:prod
```

Type `YES` when prompted.

- [ ] **Step 4: Verify existing tests still pass**

```bash
npm run test:web
```

---

## Verification

After all tasks complete:

```bash
npm run test:web          # must pass (no new failures)
npm run typecheck         # must have zero errors
```

Key test files to confirm green:
- `apps/web/test/lib/analytics/link-classifier.test.ts`
- `apps/web/test/lib/analytics/engagement-score.test.ts`
- `apps/web/test/lib/analytics/insights-engine.test.ts`
- `apps/web/test/lib/analytics/analytics-queries.test.ts`
- `apps/web/test/cms/analytics-kpi-row.test.tsx`
- `apps/web/test/cms/analytics-content-funnel.test.tsx`
- `apps/web/test/cms/analytics-links-panels.test.tsx`
- `apps/web/test/cms/analytics-clicks-chart.test.tsx`
- `apps/web/test/cms/analytics-insights-strip.test.tsx`
- `apps/web/test/cms/analytics-overview.test.tsx`
- `apps/web/test/lib/tracking/use-link-tracking.test.ts`
- `apps/web/test/cms/analytics-actions.test.ts` (existing — must stay green)
