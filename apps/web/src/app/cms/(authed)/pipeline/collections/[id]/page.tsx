import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { CollectionDetail } from '../../_components/collection-detail'

export const dynamic = 'force-dynamic'

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: collection } = await supabase
    .from('content_collections')
    .select('*')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!collection) notFound()

  const { data: rawMembers } = await supabase
    .from('content_pipeline_memberships')
    .select('position, role, content_pipeline(id, code, title_pt, title_en, format, stage, priority, tags, language)')
    .eq('collection_id', id)
    .order('position')

  const members = (rawMembers ?? []).map((m: Record<string, unknown>) => ({
    position: m.position as number,
    role: m.role as string | null,
    content_pipeline: Array.isArray(m.content_pipeline) ? m.content_pipeline[0] ?? null : m.content_pipeline ?? null,
  }))

  return (
    <>
      <CmsTopbar title={`Collection — ${collection.name || collection.code}`} />
      <div className="p-6">
        <CollectionDetail collection={collection} members={members} />
      </div>
    </>
  )
}
