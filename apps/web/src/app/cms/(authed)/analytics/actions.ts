'use server'

import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  periodInputSchema,
  exportFormatSchema,
  exportSectionsSchema,
  type OverviewStats,
  type NewsletterEditionStat,
  type CampaignStat,
  type ContentStat,
  type PeriodInput,
  type ExportFormat,
} from './types'

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string }

export type ContentAnalyticsData = {
  posts: Array<{
    id: string; title: string; slug: string
    views: number; uniqueViews: number; readsComplete: number
    avgDepth: number; avgTime: number
    referrers: { direct: number; google: number; newsletter: number; social: number; other: number }
  }>
  totals: {
    views: number; uniqueViews: number; readsComplete: number; avgDepth: number; avgTime: number
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

function csvSafe(value: string): string {
  let v = (value ?? '').replace(/"/g, '""')
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v
  return `"${v}"`
}

async function requireViewAccess(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) {
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }
  return { siteId, userId: res.user.id }
}

async function requireEditAccess(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }
  return { siteId, userId: res.user.id }
}

function resolveDateRange(period: PeriodInput): { start: Date; end: Date } {
  const end = new Date()
  if (period.type === 'custom') {
    return { start: new Date(period.start), end: new Date(period.end) }
  }
  if (period.value === 'all') {
    return { start: new Date('2020-01-01'), end }
  }
  const days = period.value === '7d' ? 7 : period.value === '30d' ? 30 : 90
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

/* ------------------------------------------------------------------ */
/*  Actions                                                           */
/* ------------------------------------------------------------------ */

export async function fetchOverview(
  period: PeriodInput,
  compare: boolean = false,
): Promise<ActionResult<OverviewStats>> {
  const parsed = periodInputSchema.safeParse(period)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireViewAccess()
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(parsed.data)

  const [postsRes, subsRes, editionsRes] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'published')
      .gte('published_at', start.toISOString())
      .lte('published_at', end.toISOString()),
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

  const postsPublished = postsRes.count ?? 0
  const subscribers = subsRes.count ?? 0

  const editions = editionsRes.data ?? []
  const totalDelivered = editions.reduce((s, e) => s + (e.stats_delivered ?? 0), 0)
  const totalOpens = editions.reduce((s, e) => s + (e.stats_opens ?? 0), 0)
  const openRate = totalDelivered > 0 ? Math.round((totalOpens / totalDelivered) * 100) : 0

  const { data: viewRows } = await supabase
    .from('content_metrics')
    .select('views')
    .eq('site_id', siteId)
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0])

  const totalViews = (viewRows ?? []).reduce(
    (sum: number, row: { views: number }) => sum + (row.views ?? 0), 0
  )

  let prevPostsPublished: number | null = null
  let prevTotalViews: number | null = null
  let prevSubscribers: number | null = null
  let prevOpenRate: number | null = null

  if (compare) {
    const prevRange = resolvePrevDateRange(parsed.data)
    if (prevRange) {
      const [prevPostsRes, prevViewsRes, prevEditionsRes] = await Promise.all([
        supabase
          .from('blog_posts')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('status', 'published')
          .gte('published_at', prevRange.start.toISOString())
          .lte('published_at', prevRange.end.toISOString()),
        supabase
          .from('content_metrics')
          .select('views')
          .eq('site_id', siteId)
          .gte('date', prevRange.start.toISOString().split('T')[0])
          .lte('date', prevRange.end.toISOString().split('T')[0]),
        supabase
          .from('newsletter_editions')
          .select('stats_delivered, stats_opens')
          .eq('site_id', siteId)
          .eq('status', 'sent')
          .gte('sent_at', prevRange.start.toISOString())
          .lte('sent_at', prevRange.end.toISOString()),
      ])
      prevPostsPublished = prevPostsRes.count ?? 0
      prevTotalViews = (prevViewsRes.data ?? []).reduce(
        (sum: number, row: { views: number }) => sum + (row.views ?? 0), 0
      )
      prevSubscribers = 0

      const prevEditions = prevEditionsRes.data ?? []
      const prevDelivered = prevEditions.reduce((s, e) => s + (e.stats_delivered ?? 0), 0)
      const prevOpens = prevEditions.reduce((s, e) => s + (e.stats_opens ?? 0), 0)
      prevOpenRate = prevDelivered > 0 ? Math.round((prevOpens / prevDelivered) * 100) : 0
    }
  }

  return {
    ok: true,
    data: {
      postsPublished,
      totalViews,
      subscribers,
      openRate,
      prevPostsPublished,
      prevTotalViews,
      prevSubscribers,
      prevOpenRate,
    },
  }
}

export async function fetchNewsletterStats(
  period: PeriodInput,
): Promise<ActionResult<NewsletterEditionStat[]>> {
  const parsed = periodInputSchema.safeParse(period)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireViewAccess()
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(parsed.data)

  const { data, error } = await supabase
    .from('newsletter_editions')
    .select('id, subject, sent_at, stats_delivered, stats_opens, stats_clicks, stats_bounces')
    .eq('site_id', siteId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}

export async function fetchCampaignStats(
  period: PeriodInput,
): Promise<ActionResult<CampaignStat[]>> {
  const parsed = periodInputSchema.safeParse(period)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireViewAccess()
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(parsed.data)

  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id, status, published_at')
    .eq('site_id', siteId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (campErr) return { ok: false, error: campErr.message }

  const campaignIds = (campaigns ?? []).map((c) => c.id)

  if (campaignIds.length === 0) {
    return { ok: true, data: [] }
  }

  const { data: translations } = await supabase
    .from('campaign_translations')
    .select('campaign_id, title')
    .in('campaign_id', campaignIds)

  const { data: submissions } = await supabase
    .from('contact_submissions')
    .select('campaign_id', { count: 'exact' })
    .in('campaign_id', campaignIds)

  const titleMap = new Map<string, string>()
  for (const t of translations ?? []) {
    if (!titleMap.has(t.campaign_id)) titleMap.set(t.campaign_id, t.title)
  }

  const submissionCounts = new Map<string, number>()
  for (const s of submissions ?? []) {
    if (s.campaign_id) {
      submissionCounts.set(s.campaign_id, (submissionCounts.get(s.campaign_id) ?? 0) + 1)
    }
  }

  const result: CampaignStat[] = (campaigns ?? []).map((c) => ({
    id: c.id,
    title: titleMap.get(c.id) ?? 'Untitled',
    status: c.status,
    submissions_count: submissionCounts.get(c.id) ?? 0,
    published_at: c.published_at,
  }))

  return { ok: true, data: result }
}

export async function fetchContentStats(
  period: PeriodInput,
): Promise<ActionResult<ContentStat[]>> {
  const parsed = periodInputSchema.safeParse(period)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireViewAccess()
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(parsed.data)

  const { data: posts, error: postErr } = await supabase
    .from('blog_posts')
    .select('id, status, published_at, owner_user_id')
    .eq('site_id', siteId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(100)

  if (postErr) return { ok: false, error: postErr.message }

  const postIds = (posts ?? []).map((p) => p.id)

  if (postIds.length === 0) {
    return { ok: true, data: [] }
  }

  const { data: translations } = await supabase
    .from('blog_translations')
    .select('blog_post_id, title, locale')
    .in('blog_post_id', postIds)

  const titleMap = new Map<string, { title: string; locale: string }>()
  for (const t of translations ?? []) {
    if (!titleMap.has(t.blog_post_id)) {
      titleMap.set(t.blog_post_id, { title: t.title, locale: t.locale })
    }
  }

  const result: ContentStat[] = (posts ?? []).map((p) => ({
    id: p.id,
    title: titleMap.get(p.id)?.title ?? 'Untitled',
    locale: titleMap.get(p.id)?.locale ?? 'pt-BR',
    status: p.status,
    published_at: p.published_at,
    owner_user_id: p.owner_user_id,
  }))

  return { ok: true, data: result }
}

export async function refreshStats(): Promise<ActionResult> {
  await requireViewAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.rpc('refresh_newsletter_stats')
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function exportReport(
  format: ExportFormat,
  sections: string[],
  period: PeriodInput,
): Promise<ActionResult<string>> {
  const formatParsed = exportFormatSchema.safeParse(format)
  if (!formatParsed.success) return { ok: false, error: zodError(formatParsed.error) }

  const sectionsParsed = exportSectionsSchema.safeParse(sections)
  if (!sectionsParsed.success) return { ok: false, error: zodError(sectionsParsed.error) }

  const periodParsed = periodInputSchema.safeParse(period)
  if (!periodParsed.success) return { ok: false, error: zodError(periodParsed.error) }

  // Export requires edit access (editors+ only)
  await requireEditAccess()

  const data: Record<string, unknown> = {}
  const validSections = sectionsParsed.data

  if (validSections.includes('overview')) {
    const r = await fetchOverview(periodParsed.data)
    if (r.ok) data.overview = r.data
  }
  if (validSections.includes('newsletters')) {
    const r = await fetchNewsletterStats(periodParsed.data)
    if (r.ok) data.newsletters = r.data
  }
  if (validSections.includes('campaigns')) {
    const r = await fetchCampaignStats(periodParsed.data)
    if (r.ok) data.campaigns = r.data
  }
  if (validSections.includes('content')) {
    const r = await fetchContentStats(periodParsed.data)
    if (r.ok) data.content = r.data
  }

  if (formatParsed.data === 'json') {
    return { ok: true, data: JSON.stringify(data, null, 2) }
  }

  // CSV: flatten each section into rows
  const lines: string[] = []
  if (data.overview) {
    const o = data.overview as OverviewStats
    lines.push('Section,Metric,Value')
    lines.push(`Overview,Posts Published,${o.postsPublished}`)
    lines.push(`Overview,Total Views,${o.totalViews}`)
    lines.push(`Overview,Subscribers,${o.subscribers}`)
    lines.push(`Overview,Open Rate,${o.openRate}%`)
  }
  if (data.newsletters) {
    lines.push('')
    lines.push('Edition ID,Subject,Sent At,Delivered,Opens,Clicks,Bounces')
    for (const e of data.newsletters as NewsletterEditionStat[]) {
      lines.push(
        `${e.id},${csvSafe(e.subject ?? '')},${e.sent_at ?? ''},${e.stats_delivered},${e.stats_opens},${e.stats_clicks},${e.stats_bounces}`,
      )
    }
  }
  if (data.campaigns) {
    lines.push('')
    lines.push('Campaign ID,Title,Status,Submissions,Published At')
    for (const c of data.campaigns as CampaignStat[]) {
      lines.push(
        `${c.id},${csvSafe(c.title ?? '')},${c.status},${c.submissions_count},${c.published_at ?? ''}`,
      )
    }
  }
  if (data.content) {
    lines.push('')
    lines.push('Post ID,Title,Locale,Status,Published At')
    for (const p of data.content as ContentStat[]) {
      lines.push(
        `${p.id},${csvSafe(p.title ?? '')},${p.locale},${p.status},${p.published_at ?? ''}`,
      )
    }
  }

  return { ok: true, data: lines.join('\n') }
}

export async function fetchContentAnalytics(
  period: PeriodInput,
): Promise<ActionResult<ContentAnalyticsData>> {
  const parsed = periodInputSchema.safeParse(period)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireViewAccess()
  const supabase = getSupabaseServiceClient()
  const { start, end } = resolveDateRange(parsed.data)

  // Top posts by views in period
  const { data: topPosts, error } = await supabase
    .from('content_metrics')
    .select('resource_id, views, unique_views, reads_complete, avg_read_depth, avg_time_sec, referrer_direct, referrer_google, referrer_newsletter, referrer_social, referrer_other')
    .eq('site_id', siteId)
    .eq('resource_type', 'blog')
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0])

  if (error) return { ok: false, error: error.message }

  // Aggregate per resource_id — weight avg_read_depth and avg_time_sec by views
  const byPost = new Map<string, {
    views: number; uniqueViews: number; readsComplete: number
    weightedDepth: number; depthWeight: number; weightedTime: number; timeWeight: number
    direct: number; google: number; newsletter: number; social: number; other: number
  }>()

  for (const row of topPosts ?? []) {
    const existing = byPost.get(row.resource_id) ?? {
      views: 0, uniqueViews: 0, readsComplete: 0,
      weightedDepth: 0, depthWeight: 0, weightedTime: 0, timeWeight: 0,
      direct: 0, google: 0, newsletter: 0, social: 0, other: 0,
    }
    existing.views += row.views
    existing.uniqueViews += row.unique_views
    existing.readsComplete += row.reads_complete
    if (row.avg_read_depth > 0) {
      existing.weightedDepth += row.avg_read_depth * row.views
      existing.depthWeight += row.views
    }
    if (row.avg_time_sec > 0) {
      existing.weightedTime += row.avg_time_sec * row.views
      existing.timeWeight += row.views
    }
    existing.direct += row.referrer_direct
    existing.google += row.referrer_google
    existing.newsletter += row.referrer_newsletter
    existing.social += row.referrer_social
    existing.other += row.referrer_other
    byPost.set(row.resource_id, existing)
  }

  // Get post titles
  const postIds = Array.from(byPost.keys())
  const { data: postTitles } = postIds.length > 0
    ? await supabase
        .from('blog_translations')
        .select('blog_posts!inner(id), title, slug')
        .in('blog_posts.id', postIds)
        .limit(50)
    : { data: [] }

  const titleMap = new Map<string, { title: string; slug: string }>()
  for (const row of postTitles ?? []) {
    const bp = row['blog_posts'] as unknown as { id: string } | { id: string }[]
    const postId = Array.isArray(bp) ? bp[0]?.id : bp?.id
    if (postId) titleMap.set(postId, { title: row.title as string, slug: row.slug as string })
  }

  const posts = Array.from(byPost.entries())
    .map(([id, stats]) => ({
      id,
      title: titleMap.get(id)?.title ?? 'Unknown',
      slug: titleMap.get(id)?.slug ?? '',
      views: stats.views,
      uniqueViews: stats.uniqueViews,
      readsComplete: stats.readsComplete,
      avgDepth: stats.depthWeight > 0 ? Math.round(stats.weightedDepth / stats.depthWeight) : 0,
      avgTime: stats.timeWeight > 0 ? Math.round(stats.weightedTime / stats.timeWeight) : 0,
      referrers: {
        direct: stats.direct,
        google: stats.google,
        newsletter: stats.newsletter,
        social: stats.social,
        other: stats.other,
      },
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20)

  const totalViews2 = posts.reduce((s, p) => s + p.views, 0)
  const totals = {
    views: totalViews2,
    uniqueViews: posts.reduce((s, p) => s + p.uniqueViews, 0),
    readsComplete: posts.reduce((s, p) => s + p.readsComplete, 0),
    avgDepth: totalViews2 > 0 ? Math.round(posts.reduce((s, p) => s + p.avgDepth * p.views, 0) / totalViews2) : 0,
    avgTime: totalViews2 > 0 ? Math.round(posts.reduce((s, p) => s + p.avgTime * p.views, 0) / totalViews2) : 0,
  }

  return { ok: true, data: { posts, totals } }
}
