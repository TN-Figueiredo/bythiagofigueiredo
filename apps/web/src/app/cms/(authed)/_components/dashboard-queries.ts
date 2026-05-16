import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface KpiQueryResult {
  totalViews: number
  totalViewsSparkline: number[]
  publishedCount: number
  subscribers: number
  subscribersNet: number
  linkClicks: number
  linkClicksSparkline: number[]
  revenue: null
}

export type AttentionPriority = 'P1' | 'P2' | 'P3'

export interface AttentionItem {
  id: string
  title: string
  priority: AttentionPriority
  reason: string
  href: string
  type: 'post' | 'newsletter' | 'pipeline'
}

export interface WeekDayDot {
  type: 'post' | 'newsletter' | 'pipeline'
  title: string
  href: string
}

export interface WeekDayItem {
  date: string // YYYY-MM-DD
  label: string // 'seg', 'ter', etc.
  dayOfMonth: number
  isToday: boolean
  dots: WeekDayDot[]
}

export interface ActivityFeedItem {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  createdAt: string
  actorUserId: string | null
}

export type DashboardPeriod = '7d' | '30d' | '90d'

/* ------------------------------------------------------------------ */
/*  fetchDashboardKpis                                                 */
/* ------------------------------------------------------------------ */

export function fetchDashboardKpis(
  siteId: string,
  period: DashboardPeriod,
): Promise<KpiQueryResult> {
  return unstable_cache(
    async (): Promise<KpiQueryResult> => {
      const supabase = getSupabaseServiceClient()
      const now = new Date()
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const periodStart = new Date(now.getTime() - days * 86400000)
        .toISOString()
        .slice(0, 10)

      // Sparkline: 7 daily data points for views
      const sparklineDays: string[] = []
      for (let i = 6; i >= 0; i--) {
        sparklineDays.push(
          new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10),
        )
      }

      const [
        viewsRes,
        sparklineRes,
        publishedPostsRes,
        sentEditionsRes,
        publishedPipelineRes,
        subscribersRes,
        subscribersGainedRes,
        subscribersChurnedRes,
        linkClicksRes,
        linkSparklineRes,
      ] = await Promise.all([
        // Total views in period
        supabase
          .from('content_metrics')
          .select('views')
          .eq('site_id', siteId)
          .gte('date', periodStart),

        // Sparkline views (7 days)
        supabase
          .from('content_metrics')
          .select('date, views')
          .eq('site_id', siteId)
          .gte('date', sparklineDays[0]),

        // Published blog posts in period
        supabase
          .from('blog_posts')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('status', 'published')
          .gte('published_at', periodStart),

        // Sent newsletter editions in period
        supabase
          .from('newsletter_editions')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('status', 'sent')
          .gte('sent_at', periodStart),

        // Published pipeline items in period
        supabase
          .from('content_pipeline')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('status', 'published')
          .gte('updated_at', periodStart),

        // Total confirmed subscribers
        supabase
          .from('newsletter_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('status', 'confirmed'),

        // Subscribers gained in period
        supabase
          .from('newsletter_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('status', 'confirmed')
          .gte('confirmed_at', periodStart),

        // Subscribers churned in period
        supabase
          .from('newsletter_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('status', 'unsubscribed')
          .gte('updated_at', periodStart),

        // Link clicks in period
        supabase
          .from('link_daily_metrics')
          .select('clicks')
          .eq('site_id', siteId)
          .gte('date', periodStart),

        // Link clicks sparkline (7 days)
        supabase
          .from('link_daily_metrics')
          .select('date, clicks')
          .eq('site_id', siteId)
          .gte('date', sparklineDays[0]),
      ])

      // Aggregate views
      if (viewsRes.error) console.error('[dashboard-queries]', viewsRes.error.message)
      const viewRows = (viewsRes.data ?? []) as Array<{ views: number }>
      const totalViews = viewRows.reduce((sum, r) => sum + (r.views ?? 0), 0)

      // Build views sparkline
      if (sparklineRes.error) console.error('[dashboard-queries]', sparklineRes.error.message)
      const viewsByDay = new Map<string, number>()
      for (const r of (sparklineRes.data ?? []) as Array<{ date: string; views: number }>) {
        viewsByDay.set(r.date, (viewsByDay.get(r.date) ?? 0) + r.views)
      }
      const totalViewsSparkline = sparklineDays.map((d) => viewsByDay.get(d) ?? 0)

      // Published count
      if (publishedPostsRes.error) console.error('[dashboard-queries]', publishedPostsRes.error.message)
      if (sentEditionsRes.error) console.error('[dashboard-queries]', sentEditionsRes.error.message)
      if (publishedPipelineRes.error) console.error('[dashboard-queries]', publishedPipelineRes.error.message)
      const publishedCount =
        (publishedPostsRes.count ?? 0) +
        (sentEditionsRes.count ?? 0) +
        (publishedPipelineRes.count ?? 0)

      // Subscribers
      if (subscribersRes.error) console.error('[dashboard-queries]', subscribersRes.error.message)
      if (subscribersGainedRes.error) console.error('[dashboard-queries]', subscribersGainedRes.error.message)
      if (subscribersChurnedRes.error) console.error('[dashboard-queries]', subscribersChurnedRes.error.message)
      const subscribers = subscribersRes.count ?? 0
      const subscribersNet =
        (subscribersGainedRes.count ?? 0) - (subscribersChurnedRes.count ?? 0)

      // Link clicks
      if (linkClicksRes.error) console.error('[dashboard-queries]', linkClicksRes.error.message)
      const clickRows = (linkClicksRes.data ?? []) as Array<{ clicks: number }>
      const linkClicks = clickRows.reduce((sum, r) => sum + (r.clicks ?? 0), 0)

      // Link sparkline
      if (linkSparklineRes.error) console.error('[dashboard-queries]', linkSparklineRes.error.message)
      const clicksByDay = new Map<string, number>()
      for (const r of (linkSparklineRes.data ?? []) as Array<{ date: string; clicks: number }>) {
        clicksByDay.set(r.date, (clicksByDay.get(r.date) ?? 0) + r.clicks)
      }
      const linkClicksSparkline = sparklineDays.map((d) => clicksByDay.get(d) ?? 0)

      return {
        totalViews,
        totalViewsSparkline,
        publishedCount,
        subscribers,
        subscribersNet,
        linkClicks,
        linkClicksSparkline,
        revenue: null,
      }
    },
    ['dashboard-kpis', siteId, period],
    { tags: ['dashboard'], revalidate: 60 },
  )()
}

/* ------------------------------------------------------------------ */
/*  fetchNeedsAttention                                                */
/* ------------------------------------------------------------------ */

export function fetchNeedsAttention(siteId: string): Promise<AttentionItem[]> {
  return unstable_cache(
    async (): Promise<AttentionItem[]> => {
      const supabase = getSupabaseServiceClient()
      const now = new Date()
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString()
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

      const [overdueRes, staleDraftsRes, upcomingRes, stalePipelineRes] =
        await Promise.all([
          // P1: Overdue posts (scheduled but published_at in the past)
          supabase
            .from('blog_posts')
            .select('id, published_at, blog_translations(title)')
            .eq('site_id', siteId)
            .eq('status', 'scheduled')
            .lt('published_at', now.toISOString())
            .order('published_at', { ascending: true })
            .limit(5),

          // P1: Stale drafts (14+ days untouched)
          supabase
            .from('blog_posts')
            .select('id, updated_at, blog_translations(title)')
            .eq('site_id', siteId)
            .eq('status', 'draft')
            .lt('updated_at', fourteenDaysAgo)
            .order('updated_at', { ascending: true })
            .limit(5),

          // P2: Posts scheduled within 7 days
          supabase
            .from('blog_posts')
            .select('id, published_at, blog_translations(title)')
            .eq('site_id', siteId)
            .eq('status', 'scheduled')
            .gte('published_at', now.toISOString())
            .lte('published_at', sevenDaysFromNow)
            .order('published_at', { ascending: true })
            .limit(5),

          // P3: Pipeline ideas stale 30+ days
          supabase
            .from('content_pipeline')
            .select('id, title, updated_at')
            .eq('site_id', siteId)
            .eq('status', 'idea')
            .lt('updated_at', thirtyDaysAgo)
            .order('updated_at', { ascending: true })
            .limit(5),
        ])

      if (overdueRes.error) console.error('[dashboard-queries]', overdueRes.error.message)
      if (staleDraftsRes.error) console.error('[dashboard-queries]', staleDraftsRes.error.message)
      if (upcomingRes.error) console.error('[dashboard-queries]', upcomingRes.error.message)
      if (stalePipelineRes.error) console.error('[dashboard-queries]', stalePipelineRes.error.message)

      const items: AttentionItem[] = []

      // P1 — overdue
      type PostRow = { id: string; published_at: string; blog_translations: Array<{ title: string }> | null }
      for (const row of (overdueRes.data ?? []) as PostRow[]) {
        const title = Array.isArray(row.blog_translations)
          ? row.blog_translations[0]?.title ?? 'Untitled'
          : 'Untitled'
        items.push({
          id: row.id,
          title,
          priority: 'P1',
          reason: 'Post atrasado',
          href: `/cms/blog/${row.id}/edit`,
          type: 'post',
        })
      }

      // P1 — stale drafts
      type DraftRow = { id: string; updated_at: string; blog_translations: Array<{ title: string }> | null }
      for (const row of (staleDraftsRes.data ?? []) as DraftRow[]) {
        const title = Array.isArray(row.blog_translations)
          ? row.blog_translations[0]?.title ?? 'Untitled'
          : 'Untitled'
        items.push({
          id: row.id,
          title,
          priority: 'P1',
          reason: 'Rascunho parado 14+ dias',
          href: `/cms/blog/${row.id}/edit`,
          type: 'post',
        })
      }

      // P2 — upcoming scheduled
      for (const row of (upcomingRes.data ?? []) as PostRow[]) {
        const title = Array.isArray(row.blog_translations)
          ? row.blog_translations[0]?.title ?? 'Untitled'
          : 'Untitled'
        items.push({
          id: row.id,
          title,
          priority: 'P2',
          reason: 'Agendado para esta semana',
          href: `/cms/blog/${row.id}/edit`,
          type: 'post',
        })
      }

      // P3 — stale pipeline
      type PipelineRow = { id: string; title: string; updated_at: string }
      for (const row of (stalePipelineRes.data ?? []) as PipelineRow[]) {
        items.push({
          id: row.id,
          title: row.title ?? 'Untitled',
          priority: 'P3',
          reason: 'Ideia parada 30+ dias',
          href: `/cms/pipeline?item=${row.id}`,
          type: 'pipeline',
        })
      }

      // Sort P1 > P2 > P3, max 5
      const priorityOrder: Record<AttentionPriority, number> = { P1: 0, P2: 1, P3: 2 }
      return items
        .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
        .slice(0, 5)
    },
    ['dashboard-attention', siteId],
    { tags: ['dashboard'], revalidate: 60 },
  )()
}

/* ------------------------------------------------------------------ */
/*  fetchThisWeekStrip                                                 */
/* ------------------------------------------------------------------ */

export function fetchThisWeekStrip(
  siteId: string,
  timezone: string,
): Promise<WeekDayItem[]> {
  return unstable_cache(
    async (): Promise<WeekDayItem[]> => {
      const supabase = getSupabaseServiceClient()

      // Find Monday of this week in the given timezone
      const now = new Date()
      const todayStr = now.toLocaleDateString('sv-SE', { timeZone: timezone })
      const todayDate = new Date(todayStr + 'T12:00:00Z')
      const dayOfWeek = todayDate.getUTCDay() // 0=Sun
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(todayDate.getTime() + mondayOffset * 86400000)

      const weekDates: string[] = []
      for (let i = 0; i < 7; i++) {
        weekDates.push(
          new Date(monday.getTime() + i * 86400000).toISOString().slice(0, 10),
        )
      }

      const weekStart = weekDates[0] + 'T00:00:00Z'
      const weekEnd = weekDates[6] + 'T23:59:59Z'

      const [postsRes, editionsRes, pipelineRes] = await Promise.all([
        supabase
          .from('blog_posts')
          .select('id, published_at, blog_translations(title)')
          .eq('site_id', siteId)
          .in('status', ['published', 'scheduled'])
          .gte('published_at', weekStart)
          .lte('published_at', weekEnd)
          .limit(30),

        supabase
          .from('newsletter_editions')
          .select('id, subject, scheduled_at, sent_at')
          .eq('site_id', siteId)
          .or(`scheduled_at.gte.${weekStart},sent_at.gte.${weekStart}`)
          .or(`scheduled_at.lte.${weekEnd},sent_at.lte.${weekEnd}`)
          .limit(30),

        supabase
          .from('content_pipeline')
          .select('id, title, updated_at')
          .eq('site_id', siteId)
          .eq('status', 'published')
          .gte('updated_at', weekStart)
          .lte('updated_at', weekEnd)
          .limit(30),
      ])

      if (postsRes.error) console.error('[dashboard-queries]', postsRes.error.message)
      if (editionsRes.error) console.error('[dashboard-queries]', editionsRes.error.message)
      if (pipelineRes.error) console.error('[dashboard-queries]', pipelineRes.error.message)

      const dayLabels = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

      const dotsByDay = new Map<string, WeekDayDot[]>()
      for (const d of weekDates) dotsByDay.set(d, [])

      // Posts
      type PostRow = { id: string; published_at: string; blog_translations: Array<{ title: string }> | null }
      for (const row of (postsRes.data ?? []) as PostRow[]) {
        const day = row.published_at?.slice(0, 10)
        if (day && dotsByDay.has(day)) {
          const title = Array.isArray(row.blog_translations)
            ? row.blog_translations[0]?.title ?? 'Post'
            : 'Post'
          dotsByDay.get(day)!.push({
            type: 'post',
            title,
            href: `/cms/blog/${row.id}/edit`,
          })
        }
      }

      // Newsletter editions
      type EditionRow = { id: string; subject: string | null; scheduled_at: string | null; sent_at: string | null }
      for (const row of (editionsRes.data ?? []) as EditionRow[]) {
        const dateStr = row.sent_at ?? row.scheduled_at
        const day = dateStr?.slice(0, 10)
        if (day && dotsByDay.has(day)) {
          dotsByDay.get(day)!.push({
            type: 'newsletter',
            title: row.subject ?? 'Newsletter',
            href: `/cms/newsletters/${row.id}/edit`,
          })
        }
      }

      // Pipeline items
      type PipelineRow = { id: string; title: string; updated_at: string }
      for (const row of (pipelineRes.data ?? []) as PipelineRow[]) {
        const day = row.updated_at?.slice(0, 10)
        if (day && dotsByDay.has(day)) {
          dotsByDay.get(day)!.push({
            type: 'pipeline',
            title: row.title ?? 'Pipeline',
            href: `/cms/pipeline?item=${row.id}`,
          })
        }
      }

      return weekDates.map((date, i) => ({
        date,
        label: dayLabels[i] ?? '',
        dayOfMonth: parseInt(date.slice(8, 10), 10),
        isToday: date === todayStr,
        dots: dotsByDay.get(date) ?? [],
      }))
    },
    ['dashboard-week-strip', siteId, timezone],
    { tags: ['dashboard'], revalidate: 60 },
  )()
}

/* ------------------------------------------------------------------ */
/*  fetchActivityFeed                                                  */
/* ------------------------------------------------------------------ */

export function fetchActivityFeed(siteId: string): Promise<ActivityFeedItem[]> {
  return unstable_cache(
    async (): Promise<ActivityFeedItem[]> => {
      const supabase = getSupabaseServiceClient()

      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, resource_type, resource_id, created_at, actor_user_id')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) {
        console.error('[dashboard-queries]', error.message)
        return []
      }

      type AuditRow = {
        id: string
        action: string
        resource_type: string
        resource_id: string | null
        created_at: string
        actor_user_id: string | null
      }

      return ((data ?? []) as AuditRow[]).map((row) => ({
        id: row.id,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        createdAt: row.created_at,
        actorUserId: row.actor_user_id,
      }))
    },
    ['dashboard-activity-feed', siteId],
    { tags: ['dashboard'], revalidate: 60 },
  )()
}
