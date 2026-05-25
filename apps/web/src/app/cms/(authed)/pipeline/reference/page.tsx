import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { ReferenceEditor } from '../_components/reference-editor'
import { REFERENCE_GROUPS } from '@/lib/pipeline/reference-groups'
import { upsertReference } from '../actions'

export const dynamic = 'force-dynamic'

export default async function ReferencePage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [{ data: docs }, { data: groupsDirective }] = await Promise.all([
    supabase
      .from('reference_content')
      .select('key, title, content_md, content_compact, ref_group, sort_order, updated_at')
      .eq('site_id', siteId)
      .order('ref_group')
      .order('sort_order')
      .order('key'),
    supabase
      .from('reference_content')
      .select('content_compact')
      .eq('site_id', siteId)
      .eq('key', '_system/groups')
      .single(),
  ])

  const dynamicGroups = (groupsDirective?.content_compact as { groups?: Array<{ id: string; label: string; color: string }> } | null)?.groups
  const groups = dynamicGroups ?? REFERENCE_GROUPS.map((g) => ({ id: g.id, label: g.label, color: g.color }))

  return (
    <>
      <CmsTopbar title="Reference" />
      <div className="p-6">
        <ReferenceEditor docs={docs ?? []} groups={groups} onUpsert={upsertReference} pipelineKey={process.env.PIPELINE_COWORK_KEY ?? ''} />
      </div>
    </>
  )
}
