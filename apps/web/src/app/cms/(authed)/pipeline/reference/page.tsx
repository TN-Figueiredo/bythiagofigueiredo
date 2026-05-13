import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { ReferenceEditor } from '../_components/reference-editor'

export const dynamic = 'force-dynamic'

export default async function ReferencePage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: docs } = await supabase
    .from('reference_content')
    .select('key, title, content_md, content_compact, ref_group, sort_order, updated_at')
    .eq('site_id', siteId)
    .order('ref_group')
    .order('sort_order')
    .order('key')

  return (
    <>
      <CmsTopbar title="Pipeline — Reference" />
      <div className="p-6">
        <ReferenceEditor docs={docs ?? []} />
      </div>
    </>
  )
}
