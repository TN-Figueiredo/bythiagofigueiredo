import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineListTable } from '../_components/pipeline-list-table'

export const dynamic = 'force-dynamic'

export default async function PipelineListPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: items } = await supabase
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, format, stage, priority, language, updated_at, production_checklist, validation_score')
    .eq('site_id', siteId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .limit(200)

  return (
    <>
      <CmsTopbar title="Pipeline — All Items" />
      <div className="p-6">
        <PipelineListTable items={items ?? []} />
      </div>
    </>
  )
}
