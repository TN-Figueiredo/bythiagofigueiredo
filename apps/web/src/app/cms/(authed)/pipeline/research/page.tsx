import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import { ResearchLibrary } from './_components/research-library'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [topicsRes, itemsRes, countsByTopicRes] = await Promise.all([
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
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('research_items')
      .select('topic_id, status')
      .eq('site_id', siteId),
  ])

  if (topicsRes.error) console.error('[research] topics query:', topicsRes.error.message)
  if (itemsRes.error) console.error('[research] items query:', itemsRes.error.message)
  if (countsByTopicRes.error) console.error('[research] counts query:', countsByTopicRes.error.message)

  const topics = topicsRes.data ?? []
  const items = itemsRes.data ?? []
  const countRows = (countsByTopicRes.data ?? []) as Array<{ topic_id: string; status: string }>

  const stats = { total: 0, unread: 0, starred: 0, reviewed: 0, archived: 0 }
  const topicItemCounts: Record<string, { total: number; unread: number }> = {}

  for (const row of countRows) {
    stats.total++
    if (row.status === 'new') stats.unread++
    else if (row.status === 'starred') stats.starred++
    else if (row.status === 'reviewed') stats.reviewed++
    else if (row.status === 'archived') stats.archived++

    const counts = topicItemCounts[row.topic_id] ?? (topicItemCounts[row.topic_id] = { total: 0, unread: 0 })
    counts.total++
    if (row.status === 'new') counts.unread++
  }

  return (
    <>
      <CmsTopbar title="Research Library" />
      <div className="p-4 gem-pipeline-theme" style={{ height: 'calc(100vh - 6rem)', ...GEM_CSS_VARS } as React.CSSProperties}>
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
