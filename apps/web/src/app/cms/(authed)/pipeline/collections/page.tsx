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

  const { data: rawCollections } = await supabase
    .from('content_collections')
    .select('id, code, name, type, description, content_pipeline_memberships(count)')
    .eq('site_id', siteId)
    .order('type')
    .order('position')

  const collections = (rawCollections ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    code: c.code as string,
    name: (c.name as string) ?? (c.code as string),
    type: c.type as string,
    description: (c.description as string | null) ?? null,
    memberCount: (Array.isArray(c.content_pipeline_memberships) ? (c.content_pipeline_memberships[0] as { count: number } | undefined)?.count : 0) ?? 0,
    progress: 0,
    nextItem: null,
  }))

  return (
    <>
      <CmsTopbar title="Pipeline — Collections" />
      <div className="p-6">
        <CollectionManager collections={collections} />
      </div>
    </>
  )
}
