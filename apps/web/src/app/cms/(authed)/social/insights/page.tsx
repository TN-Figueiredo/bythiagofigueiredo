import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getSocialStrings } from '../_i18n'
import { InsightsOverview } from './_components/insights-overview'
import { InsightsBestOf } from './_components/insights-best-of'
import { InsightsHealth } from './_components/insights-health'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

async function loadInsightsData(siteId: string) {
  const supabase = getSupabaseServiceClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const since = thirtyDaysAgo.toISOString()

  const [postsRes, connectionsRes] = await Promise.all([
    supabase
      .from('social_posts')
      .select('id, status, published_at, origin, content, created_at, short_link_id')
      .eq('site_id', siteId)
      .gte('created_at', since),
    supabase
      .from('social_connections')
      .select('id, provider, account_name, token_expires_at, revoked_at')
      .eq('site_id', siteId)
      .is('revoked_at', null),
  ])

  const posts = (postsRes.data ?? []) as Array<Record<string, unknown>>
  const postIds = posts.map(p => p.id as string)

  let deliveries: Array<Record<string, unknown>> = []
  if (postIds.length > 0) {
    const { data } = await supabase
      .from('social_deliveries')
      .select('id, post_id, status, provider, published_at')
      .in('post_id', postIds)
    deliveries = (data ?? []) as Array<Record<string, unknown>>
  }

  const postsPublished = posts.filter(p => p.status === 'completed').length
  const totalDeliveries = deliveries.length
  const successDeliveries = deliveries.filter(d => d.status === 'published').length
  const deliverySuccessRate = totalDeliveries > 0
    ? Math.round((successDeliveries / totalDeliveries) * 100)
    : 0
  const aiDraftsApproved = posts.filter(p =>
    (p.origin === 'pipeline' || p.origin === 'auto') && p.status === 'completed'
  ).length

  const shortLinkIds = posts
    .map(p => p.short_link_id as string | null)
    .filter((id): id is string => id !== null)

  let linkClicks = 0
  if (shortLinkIds.length > 0) {
    const { count } = await supabase
      .from('link_clicks')
      .select('id', { count: 'exact', head: true })
      .in('link_id', shortLinkIds)
      .gte('clicked_at', since)
    linkClicks = count ?? 0
  }

  const chartMap = new Map<string, { clicks: number; engagement: number; posts: number }>()
  for (const p of posts) {
    const date = String(p.created_at).split('T')[0] ?? ''
    if (!date) continue
    const entry = chartMap.get(date) ?? { clicks: 0, engagement: 0, posts: 0 }
    entry.posts += 1
    if (p.status === 'completed') entry.engagement += 1
    chartMap.set(date, entry)
  }
  const chartData = Array.from(chartMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const heatmapMap = new Map<string, number>()
  for (const p of posts) {
    if (!p.published_at) continue
    const dt = new Date(p.published_at as string)
    const key = `${dt.getDay()}-${dt.getHours()}`
    heatmapMap.set(key, (heatmapMap.get(key) ?? 0) + 1)
  }
  const heatmapData = Array.from(heatmapMap.entries()).map(([key, value]) => {
    const parts = key.split('-')
    return { day: Number(parts[0]), hour: Number(parts[1]), value }
  })

  const topPosts = posts
    .filter(p => p.status === 'completed')
    .slice(0, 5)
    .map(p => {
      const content = p.content as { title?: string; description?: string } | null
      const postDeliveries = deliveries.filter(d => d.post_id === p.id)
      return {
        id: p.id as string,
        label: content?.title ?? content?.description?.slice(0, 50) ?? 'Post',
        value: postDeliveries.filter(d => d.status === 'published').length,
      }
    })

  const connections = (connectionsRes.data ?? []) as Array<{
    provider: 'youtube' | 'facebook' | 'instagram' | 'bluesky'
    account_name: string | null
    token_expires_at: string | null
    revoked_at: string | null
  }>

  return {
    kpis: { postsPublished, deliverySuccessRate, linkClicks, avgEngagement: totalDeliveries > 0 ? Math.round(successDeliveries / Math.max(postsPublished, 1) * 10) / 10 : 0, aiDraftsApproved },
    chartData,
    heatmapData,
    topPosts,
    connections,
  }
}

export default async function SocialInsightsPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const tab = params.tab ?? 'overview'

  const insights = await loadInsightsData(ctx.siteId)

  return (
    <>
      <CmsTopbar title={t.insights.title} />
      <div className="p-6 space-y-6">
        <div className="flex gap-2 border-b border-cms-border pb-2">
          {(['overview', 'best-of', 'platform-health'] as const).map(tabId => {
            const tabKey = tabId === 'best-of' ? 'bestOf' : tabId === 'platform-health' ? 'platformHealth' : 'overview'
            return (
              <a
                key={tabId}
                href={tabId === 'overview' ? '/cms/social/insights' : `/cms/social/insights?tab=${tabId}`}
                className={`px-3 py-1.5 text-sm font-medium ${tab === tabId ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
              >
                {t.insights.tabs[tabKey]}
              </a>
            )
          })}
        </div>

        {tab === 'overview' && <InsightsOverview data={insights} strings={t} />}
        {tab === 'best-of' && <InsightsBestOf topThumbnails={[]} topTitles={[]} topPosts={insights.topPosts} strings={t} />}
        {tab === 'platform-health' && <InsightsHealth connections={insights.connections} strings={t} />}
      </div>
    </>
  )
}
