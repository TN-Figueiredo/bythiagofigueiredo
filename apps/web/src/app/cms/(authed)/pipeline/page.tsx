import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { FORMATS } from '@/lib/pipeline/schemas'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineOverviewCards } from './_components/pipeline-overview-cards'

export const dynamic = 'force-dynamic'

export default async function PipelineOverviewPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: items } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, priority, updated_at')
    .eq('site_id', siteId)
    .eq('is_archived', false)

  const stats = FORMATS.map((format) => {
    const formatItems = items?.filter((i) => i.format === format) ?? []
    const byStage: Record<string, number> = {}
    WORKFLOWS[format].forEach((s) => { byStage[s.stage] = formatItems.filter((i) => i.stage === s.stage).length })
    return { format, total: formatItems.length, byStage }
  })

  return (
    <>
      <CmsTopbar title="Pipeline Overview" />
      <div className="p-6">
        <PipelineOverviewCards stats={stats} />
      </div>
    </>
  )
}
