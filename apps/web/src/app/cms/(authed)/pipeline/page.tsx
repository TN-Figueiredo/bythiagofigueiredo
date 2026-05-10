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

  const [statsRes, nextToRecordRes, topPriorityRes, playlistsRes, activityRes] = await Promise.all([
    supabase.from('content_pipeline').select('id, format, stage, priority, is_archived', { count: 'exact' }).eq('site_id', siteId).eq('is_archived', false),
    supabase.from('content_pipeline').select('id, code, title_pt, format, priority, updated_at').eq('site_id', siteId).eq('is_archived', false).not('body_content', 'is', null).in('stage', ['roteiro', 'draft', 'outline']).order('priority', { ascending: false }).order('updated_at', { ascending: true }).limit(3),
    supabase.from('content_pipeline').select('id, code, title_pt, format, priority, stage, updated_at').eq('site_id', siteId).eq('is_archived', false).gte('priority', 4).not('stage', 'in', '(scheduled,published,sent)').order('priority', { ascending: false }).limit(5),
    supabase.from('content_collections').select(`id, code, name, description, type, content_pipeline_memberships(role, content_pipeline(id, code, title_pt, stage))`).eq('site_id', siteId).eq('type', 'playlist').order('position'),
    supabase.from('content_pipeline_history').select('id, event_type, to_value, changed_at, pipeline_id, content_pipeline(code, format)').eq('content_pipeline.site_id', siteId).order('changed_at', { ascending: false }).limit(5),
  ])

  const allItems = statsRes.data ?? []
  const finalStages = new Set(['published', 'scheduled', 'sent'])
  const stats = {
    total: allItems.length,
    inProgress: allItems.filter((i: any) => !finalStages.has(i.stage)).length,
    highPriority: allItems.filter((i: any) => i.priority >= 4).length,
    scriptsReady: allItems.filter((i: any) => ['roteiro', 'draft', 'outline'].includes(i.stage)).length,
    published: allItems.filter((i: any) => finalStages.has(i.stage)).length,
  }

  const recommendations = {
    nextToRecord: (nextToRecordRes.data ?? []).map((i: any) => ({ id: i.id, code: i.code, title_pt: i.title_pt, format: i.format, priority: i.priority, updated_at: i.updated_at })),
    topPriority: (topPriorityRes.data ?? []).map((i: any) => ({ id: i.id, code: i.code, title_pt: i.title_pt, format: i.format, priority: i.priority, stage: i.stage, updated_at: i.updated_at })),
  }

  const playlists = (playlistsRes.data ?? []).map((pl: any) => {
    const members = (pl.content_pipeline_memberships ?? []) as Array<{ role: string | null; content_pipeline: { id: string; code: string; title_pt: string | null; stage: string } | null }>
    const validMembers = members.filter((m) => m.content_pipeline)
    const pastIdea = validMembers.filter((m) => m.content_pipeline!.stage !== 'idea').length
    const firstNonIdea = validMembers.find((m) => m.content_pipeline!.stage !== 'idea')
    return {
      id: pl.id, code: pl.code, name: pl.name ?? pl.code, description: pl.description ?? null,
      progress: pastIdea, total: validMembers.length,
      nextItem: firstNonIdea?.content_pipeline ? { code: firstNonIdea.content_pipeline.code, title: firstNonIdea.content_pipeline.title_pt ?? 'Untitled' } : null,
    }
  })

  const activity = (activityRes.data ?? []).filter((h: any) => h.content_pipeline).map((h: any) => ({
    id: h.id, code: h.content_pipeline.code, format: h.content_pipeline.format,
    event_type: h.event_type, to_value: h.to_value, changed_at: h.changed_at,
  }))

  return (
    <>
      <CmsTopbar title="Pipeline Overview" />
      <div className="p-6 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineOverview stats={stats} recommendations={recommendations} playlists={playlists} activity={activity} />
      </div>
    </>
  )
}
