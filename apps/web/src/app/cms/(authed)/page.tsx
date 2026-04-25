import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import {
  DashboardConnected,
  type DashboardData,
  type ComingUpItem,
  type DraftItem,
  type ActivityItem,
  type TopContentRow,
  type LastNewsletterData,
} from './_components/dashboard-connected'

/* ------------------------------------------------------------------ */
/*  Data fetchers                                                     */
/* ------------------------------------------------------------------ */

async function fetchDashboardData(siteId: string): Promise<DashboardData> {
  const supabase = getSupabaseServiceClient()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString()

  const [
    publishedRes,
    publishedPrevRes,
    subscribersRes,
    subscribersPrevRes,
    unreadRes,
    lastEditionRes,
    avgOpenRes,
    avgOpenPrevRes,
    comingUpPostsRes,
    comingUpNewslettersRes,
    draftsPostsRes,
    draftsNewslettersRes,
    draftsCampaignsRes,
    activityRes,
    topPostsRes,
    topNewslettersRes,
    topCampaignsRes,
  ] = await Promise.all([
    // Published posts count (current 30d)
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'published')
      .gte('published_at', thirtyDaysAgo),

    // Published posts count (previous 30d)
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'published')
      .gte('published_at', sixtyDaysAgo)
      .lt('published_at', thirtyDaysAgo),

    // Subscriber count
    supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'confirmed'),

    // Subscriber count 30d ago (subscribers who confirmed before 30d ago)
    supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'confirmed')
      .lt('confirmed_at', thirtyDaysAgo),

    // Unread contact messages
    supabase
      .from('contact_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .is('replied_at', null)
      .is('anonymized_at', null),

    // Last sent newsletter edition
    supabase
      .from('newsletter_editions')
      .select(
        'id, subject, sent_at, stats_delivered, stats_opens, stats_clicks, stats_bounces',
      )
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Avg open rate (current 30d editions)
    supabase
      .from('newsletter_editions')
      .select('stats_delivered, stats_opens')
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .gte('sent_at', thirtyDaysAgo),

    // Avg open rate (previous 30d editions)
    supabase
      .from('newsletter_editions')
      .select('stats_delivered, stats_opens')
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .gte('sent_at', sixtyDaysAgo)
      .lt('sent_at', thirtyDaysAgo),

    // Coming up: scheduled blog posts
    supabase
      .from('blog_posts')
      .select('id, site_id, status, published_at, blog_translations(title, locale)')
      .eq('site_id', siteId)
      .eq('status', 'scheduled')
      .gte('published_at', now.toISOString())
      .lte('published_at', sevenDaysFromNow)
      .order('published_at', { ascending: true })
      .limit(10),

    // Coming up: scheduled newsletter editions
    supabase
      .from('newsletter_editions')
      .select('id, subject, scheduled_at')
      .eq('site_id', siteId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', sevenDaysFromNow)
      .order('scheduled_at', { ascending: true })
      .limit(10),

    // Continue editing: draft posts
    supabase
      .from('blog_posts')
      .select('id, updated_at, blog_translations(title)')
      .eq('site_id', siteId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(3),

    // Continue editing: draft newsletters
    supabase
      .from('newsletter_editions')
      .select('id, subject, updated_at')
      .eq('site_id', siteId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(2),

    // Continue editing: draft campaigns
    supabase
      .from('campaigns')
      .select('id, updated_at, campaign_translations(title)')
      .eq('site_id', siteId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(2),

    // Recent activity
    supabase
      .from('audit_log')
      .select('id, action, resource_type, resource_id, created_at, actor_user_id')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(5),

    // Top posts (by published_at recency as proxy for views)
    supabase
      .from('blog_posts')
      .select('id, blog_translations(title, locale)')
      .eq('site_id', siteId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3),

    // Top newsletters
    supabase
      .from('newsletter_editions')
      .select('id, subject, stats_opens')
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .order('stats_opens', { ascending: false })
      .limit(3),

    // Top campaigns
    supabase
      .from('campaigns')
      .select('id, campaign_translations(title, locale)')
      .eq('site_id', siteId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3),
  ])

  // --- KPIs ---
  const publishedPosts = publishedRes.count ?? 0
  const publishedPrev = publishedPrevRes.count ?? 0
  const publishedPostsDelta =
    publishedPrev > 0
      ? ((publishedPosts - publishedPrev) / publishedPrev) * 100
      : null

  const subscribers = subscribersRes.count ?? 0
  const subscribersPrev = subscribersPrevRes.count ?? 0
  const subscribersDelta =
    subscribersPrev > 0
      ? ((subscribers - subscribersPrev) / subscribersPrev) * 100
      : null

  const unreadMessages = unreadRes.count ?? 0

  // Avg open rate
  function computeOpenRate(
    editions: Array<{ stats_delivered: number; stats_opens: number }> | null,
  ): number | null {
    if (!editions || editions.length === 0) return null
    let totalDelivered = 0
    let totalOpens = 0
    for (const e of editions) {
      totalDelivered += e.stats_delivered ?? 0
      totalOpens += e.stats_opens ?? 0
    }
    return totalDelivered > 0 ? (totalOpens / totalDelivered) * 100 : null
  }

  const avgOpenRate = computeOpenRate(
    avgOpenRes.data as Array<{ stats_delivered: number; stats_opens: number }> | null,
  )
  const avgOpenPrev = computeOpenRate(
    avgOpenPrevRes.data as Array<{ stats_delivered: number; stats_opens: number }> | null,
  )
  const avgOpenRateDelta =
    avgOpenRate !== null && avgOpenPrev !== null
      ? avgOpenRate - avgOpenPrev
      : null

  // --- Last newsletter ---
  const lastEdition = lastEditionRes.data
  const lastNewsletter: LastNewsletterData | null = lastEdition
    ? {
        id: lastEdition.id as string,
        subject: (lastEdition.subject as string) ?? 'Untitled',
        sentAt: (lastEdition.sent_at as string) ?? now.toISOString(),
        delivered: (lastEdition.stats_delivered as number) ?? 0,
        opens: (lastEdition.stats_opens as number) ?? 0,
        clicks: (lastEdition.stats_clicks as number) ?? 0,
        bounces: (lastEdition.stats_bounces as number) ?? 0,
      }
    : null

  // --- Coming up ---
  type PostWithTranslations = {
    id: string
    published_at: string
    blog_translations: Array<{ title: string; locale: string }> | null
  }
  type EditionScheduled = {
    id: string
    subject: string | null
    scheduled_at: string
  }

  const comingUpPosts: ComingUpItem[] = (
    (comingUpPostsRes.data ?? []) as unknown as PostWithTranslations[]
  ).map((p) => {
    const translation = Array.isArray(p.blog_translations) ? p.blog_translations[0] : null
    return {
      id: p.id,
      title: translation?.title ?? 'Untitled',
      date: p.published_at,
      type: 'post' as const,
      href: `/cms/blog/${p.id}/edit`,
    }
  })

  const comingUpNewsletters: ComingUpItem[] = (
    (comingUpNewslettersRes.data ?? []) as unknown as EditionScheduled[]
  ).map((e) => ({
    id: e.id,
    title: e.subject ?? 'Untitled',
    date: e.scheduled_at,
    type: 'newsletter' as const,
    href: `/cms/newsletters/${e.id}/edit`,
  }))

  const comingUp: ComingUpItem[] = [...comingUpPosts, ...comingUpNewsletters].sort(
    (a, b) => a.date.localeCompare(b.date),
  )

  // --- Continue editing (drafts) ---
  type DraftPost = {
    id: string
    updated_at: string
    blog_translations: Array<{ title: string }> | null
  }
  type DraftNewsletter = {
    id: string
    subject: string | null
    updated_at: string
  }
  type DraftCampaign = {
    id: string
    updated_at: string
    campaign_translations: Array<{ title: string }> | null
  }

  const draftPosts: DraftItem[] = (
    (draftsPostsRes.data ?? []) as unknown as DraftPost[]
  ).map((p) => {
    const translation = Array.isArray(p.blog_translations) ? p.blog_translations[0] : null
    return {
      id: p.id,
      title: translation?.title ?? 'Untitled',
      updatedAt: p.updated_at,
      type: 'post' as const,
      href: `/cms/blog/${p.id}/edit`,
    }
  })

  const draftNewsletters: DraftItem[] = (
    (draftsNewslettersRes.data ?? []) as unknown as DraftNewsletter[]
  ).map((e) => ({
    id: e.id,
    title: e.subject ?? 'Untitled',
    updatedAt: e.updated_at,
    type: 'newsletter' as const,
    href: `/cms/newsletters/${e.id}/edit`,
  }))

  const draftCampaigns: DraftItem[] = (
    (draftsCampaignsRes.data ?? []) as unknown as DraftCampaign[]
  ).map((c) => {
    const translation = Array.isArray(c.campaign_translations) ? c.campaign_translations[0] : null
    return {
      id: c.id,
      title: translation?.title ?? 'Untitled',
      updatedAt: c.updated_at,
      type: 'campaign' as const,
      href: `/cms/campaigns/${c.id}/edit`,
    }
  })

  const drafts: DraftItem[] = [...draftPosts, ...draftNewsletters, ...draftCampaigns]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)

  // --- Recent activity ---
  const recentActivity: ActivityItem[] = (
    (activityRes.data ?? []) as Array<{
      id: string
      action: string
      resource_type: string
      resource_id: string | null
      created_at: string
      actor_user_id: string | null
    }>
  ).map((a) => ({
    id: a.id,
    action: a.action,
    resourceType: a.resource_type,
    resourceId: a.resource_id,
    createdAt: a.created_at,
    actorEmail: null, // audit_log doesn't store email; would need join
  }))

  // --- Top content ---
  type PublishedPost = {
    id: string
    blog_translations: Array<{ title: string; locale: string }> | null
  }
  type SentEdition = {
    id: string
    subject: string | null
    stats_opens: number
  }
  type PublishedCampaign = {
    id: string
    campaign_translations: Array<{ title: string; locale: string }> | null
  }

  const topPosts: TopContentRow[] = (
    (topPostsRes.data ?? []) as unknown as PublishedPost[]
  ).map((p, i) => {
    const translation = Array.isArray(p.blog_translations) ? p.blog_translations[0] : null
    return {
      id: p.id,
      title: translation?.title ?? 'Untitled',
      views: 3 - i, // placeholder ranking since we lack analytics
      locale: translation?.locale ?? 'pt-BR',
    }
  })

  const topNewsletters: TopContentRow[] = (
    (topNewslettersRes.data ?? []) as unknown as SentEdition[]
  ).map((e) => ({
    id: e.id,
    title: e.subject ?? 'Untitled',
    views: e.stats_opens ?? 0,
    locale: 'pt-BR',
  }))

  const topCampaigns: TopContentRow[] = (
    (topCampaignsRes.data ?? []) as unknown as PublishedCampaign[]
  ).map((c, i) => {
    const translation = Array.isArray(c.campaign_translations) ? c.campaign_translations[0] : null
    return {
      id: c.id,
      title: translation?.title ?? 'Untitled',
      views: 3 - i, // placeholder ranking
      locale: translation?.locale ?? 'pt-BR',
    }
  })

  return {
    kpis: {
      publishedPosts,
      publishedPostsDelta,
      subscribers,
      subscribersDelta,
      avgOpenRate,
      avgOpenRateDelta,
      unreadMessages,
    },
    lastNewsletter,
    comingUp,
    drafts,
    recentActivity,
    topPosts,
    topNewsletters,
    topCampaigns,
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default async function CmsDashboardPage() {
  const { siteId } = await getSiteContext()
  const data = await fetchDashboardData(siteId)

  return (
    <div>
      <CmsTopbar title="Dashboard" />
      <DashboardConnected data={data} />
    </div>
  )
}
