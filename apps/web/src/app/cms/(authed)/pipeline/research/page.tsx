import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { ResearchLibrary } from './_components/research-library'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [topicsRes, itemsRes, statsRes] = await Promise.all([
    supabase
      .from('research_topics')
      .select('id, parent_id, name, slug, path, depth, color, icon, sort_order')
      .eq('site_id', siteId)
      .order('depth')
      .order('sort_order'),
    supabase
      .from('research_items')
      .select('id, title, topic_id, summary, status, word_count, sources, version, created_at, updated_at')
      .eq('site_id', siteId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('research_items')
      .select('id, status, topic_id', { count: 'exact' })
      .eq('site_id', siteId),
  ])

  const topics = topicsRes.data ?? []
  const items = itemsRes.data ?? []
  const allItems = statsRes.data ?? []

  const stats = {
    total: allItems.length,
    unread: allItems.filter((i: any) => i.status === 'new').length,
    starred: allItems.filter((i: any) => i.status === 'starred').length,
    reviewed: allItems.filter((i: any) => i.status === 'reviewed').length,
    archived: allItems.filter((i: any) => i.status === 'archived').length,
  }

  const topicItemCounts: Record<string, { total: number; unread: number }> = {}
  for (const item of allItems) {
    const tid = (item as any).topic_id ?? ''
    if (!topicItemCounts[tid]) topicItemCounts[tid] = { total: 0, unread: 0 }
    topicItemCounts[tid].total++
    if ((item as any).status === 'new') topicItemCounts[tid].unread++
  }

  return (
    <>
      <CmsTopbar title="Pipeline — Research" />
      <div className="p-4" style={{ height: 'calc(100vh - 6rem)' }}>
        <ResearchLibrary
          topics={topics}
          items={items}
          stats={stats}
          topicItemCounts={topicItemCounts}
        />
      </div>
    </>
  )
}
