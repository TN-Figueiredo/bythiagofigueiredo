import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineOverviewCards } from './_components/pipeline-overview-cards'

export const dynamic = 'force-dynamic'

export default async function PipelineOverviewPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: collections } = await supabase
    .from('content_collections')
    .select(`
      id, code, name, type, position,
      content_pipeline_memberships(
        role,
        content_pipeline(id, format, stage)
      )
    `)
    .eq('site_id', siteId)
    .order('position')

  const collectionStats = (collections ?? []).map((c) => {
    const members = c.content_pipeline_memberships ?? []
    const items = members
      .map((m: Record<string, unknown>) => m.content_pipeline)
      .filter(Boolean) as Array<{ id: string; format: string; stage: string }>

    const byFormat: Record<string, number> = {}
    const byStage: Record<string, number> = {}
    for (const item of items) {
      byFormat[item.format] = (byFormat[item.format] || 0) + 1
      byStage[item.stage] = (byStage[item.stage] || 0) + 1
    }

    return {
      id: c.id,
      code: c.code,
      name: c.name ?? c.code,
      total: items.length,
      byFormat,
      byStage,
    }
  })

  return (
    <>
      <CmsTopbar title="Pipeline Overview" />
      <div className="p-6">
        <PipelineOverviewCards collections={collectionStats} />
      </div>
    </>
  )
}
