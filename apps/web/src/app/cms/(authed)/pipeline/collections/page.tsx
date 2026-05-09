import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { CollectionManager } from '../_components/collection-manager'

export const dynamic = 'force-dynamic'

export default async function CollectionsPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: collections } = await supabase
    .from('content_collections')
    .select('*, content_pipeline_memberships(count)')
    .eq('site_id', siteId)
    .order('type')
    .order('position')

  return (
    <>
      <CmsTopbar title="Pipeline — Collections" />
      <div className="p-6">
        <CollectionManager collections={collections ?? []} />
      </div>
    </>
  )
}
