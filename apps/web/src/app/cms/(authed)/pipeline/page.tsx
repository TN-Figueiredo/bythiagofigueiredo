import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import { PipelineOverview } from './_components/pipeline-overview'
import { fetchUpNextData } from '@/lib/pipeline/up-next-fetcher'
import { SITE_TIMEZONE } from '@/lib/pipeline/up-next-constants'
import type { CelebrationItem } from './_components/up-next-celebration'
import type { ActivityEntry } from './_components/up-next-activity'

export const dynamic = 'force-dynamic'

const FINAL_STAGES = ['published', 'scheduled', 'sent'] as const

interface HistoryRow {
  id: string
  event_type: string
  to_value: string | null
  changed_at: string
  pipeline_id: string
  content_pipeline: { code: string; format: string } | null
}

export default async function PipelineOverviewPage() {
  const { siteId } = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!scope.ok) { throw new Error('Forbidden') }
  const supabase = getSupabaseServiceClient()

  const now = new Date()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  // Run fetcher + independent queries in parallel (celebration & activity don't depend on fetcher)
  const [fallbackData, celebrationRes, activityRes] = await Promise.all([
    fetchUpNextData(supabase, siteId, SITE_TIMEZONE, now, 5),

    supabase
      .from('content_pipeline')
      .select('id, code, title_pt, format')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .in('stage', [...FINAL_STAGES])
      .gte('updated_at', sevenDaysAgo)
      .order('updated_at', { ascending: false })
      .limit(5),

    supabase
      .from('content_pipeline_history')
      .select('id, event_type, to_value, changed_at, pipeline_id, content_pipeline!inner(code, format, site_id)')
      .eq('content_pipeline.site_id', siteId)
      .order('changed_at', { ascending: false })
      .limit(10),
  ])

  const celebrationItems: CelebrationItem[] = (celebrationRes.data ?? []).map((item) => ({
    id: item.id, code: item.code, title_pt: item.title_pt, format: item.format,
  }))

  const activity: ActivityEntry[] = ((activityRes.data ?? []) as unknown as HistoryRow[])
    .filter((h) => h.content_pipeline)
    .map((h) => ({
      id: h.id, code: h.content_pipeline!.code, format: h.content_pipeline!.format,
      event_type: h.event_type, to_value: h.to_value, changed_at: h.changed_at,
    }))

  return (
    <>
      <CmsTopbar title="Up Next" />
      <div className="p-6 gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineOverview
          fallbackData={fallbackData}
          celebration={{ items: celebrationItems }}
          activity={activity}
        />
      </div>
    </>
  )
}
