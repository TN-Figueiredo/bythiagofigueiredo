import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { KpiCard } from '@tn-figueiredo/cms-ui/client'

export async function DashboardKpis() {
  const supabase = getSupabaseServiceClient()
  const { siteId } = await getSiteContext()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [postsRes, opensRes, subsRes, subscribersRes] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'published')
      .gte('published_at', thirtyDaysAgo),
    supabase
      .from('newsletter_editions')
      .select('stats_opens')
      .eq('site_id', siteId)
      .eq('status', 'sent')
      .gte('sent_at', thirtyDaysAgo),
    supabase
      .from('campaign_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .gte('created_at', thirtyDaysAgo),
    supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'confirmed'),
  ])

  const totalOpens = (opensRes.data ?? []).reduce(
    (sum, e) => sum + ((e as { stats_opens?: number }).stats_opens ?? 0),
    0,
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Published (30d)" value={postsRes.count ?? 0} color="default" />
      <KpiCard label="Newsletter Opens" value={totalOpens.toLocaleString()} color="green" />
      <KpiCard label="Campaign Leads" value={subsRes.count ?? 0} color="amber" />
      <KpiCard label="Subscribers" value={subscribersRes.count ?? 0} color="cyan" />
    </div>
  )
}
