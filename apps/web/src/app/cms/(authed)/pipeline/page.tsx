import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineOverview } from './_components/pipeline-overview'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'

export const dynamic = 'force-dynamic'

export default async function PipelineOverviewPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [statsRes, nextToRecordRes, topPriorityRes, activityRes] = await Promise.all([
    supabase.from('content_pipeline').select('id, format, stage, priority, is_archived', { count: 'exact' }).eq('site_id', siteId).eq('is_archived', false),
    supabase.from('content_pipeline').select('id, code, title_pt, format, priority, updated_at').eq('site_id', siteId).eq('is_archived', false).not('body_content', 'is', null).in('stage', ['roteiro', 'draft', 'outline']).order('priority', { ascending: false }).order('updated_at', { ascending: true }).limit(3),
    supabase.from('content_pipeline').select('id, code, title_pt, format, priority, stage, updated_at').eq('site_id', siteId).eq('is_archived', false).gte('priority', 4).not('stage', 'in', '(scheduled,published,sent)').order('priority', { ascending: false }).limit(5),
    supabase.from('content_pipeline_history').select('id, event_type, to_value, changed_at, pipeline_id, content_pipeline(code, format)').eq('content_pipeline.site_id', siteId).order('changed_at', { ascending: false }).limit(5),
  ])

  const allItems = statsRes.data ?? []
  const finalStages = new Set(['published', 'scheduled', 'sent'])
  const stats = {
    total: allItems.length,
    inProgress: allItems.filter((i) => !finalStages.has(i.stage)).length,
    highPriority: allItems.filter((i) => i.priority >= 4).length,
    scriptsReady: allItems.filter((i) => ['roteiro', 'draft', 'outline'].includes(i.stage)).length,
    published: allItems.filter((i) => finalStages.has(i.stage)).length,
  }

  const recommendations = {
    nextToRecord: (nextToRecordRes.data ?? []).map((i) => ({ id: i.id, code: i.code, title_pt: i.title_pt, format: i.format, priority: i.priority, updated_at: i.updated_at })),
    topPriority: (topPriorityRes.data ?? []).map((i) => ({ id: i.id, code: i.code, title_pt: i.title_pt, format: i.format, priority: i.priority, stage: i.stage, updated_at: i.updated_at })),
  }

  interface HistoryRow { id: string; event_type: string; to_value: string | null; changed_at: string; pipeline_id: string; content_pipeline: { code: string; format: string } | null }
  const activity = ((activityRes.data ?? []) as unknown as HistoryRow[]).filter((h) => h.content_pipeline).map((h) => ({
    id: h.id, code: h.content_pipeline!.code, format: h.content_pipeline!.format,
    event_type: h.event_type, to_value: h.to_value, changed_at: h.changed_at,
  }))

  return (
    <>
      <CmsTopbar title="Up Next" />
      <div className="p-6 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineOverview stats={stats} recommendations={recommendations} activity={activity} />
      </div>
    </>
  )
}
