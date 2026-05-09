import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineItemDetail } from '../../_components/pipeline-item-detail'

export const dynamic = 'force-dynamic'

export default async function PipelineItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('*')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !item) notFound()

  const { data: history } = await supabase
    .from('content_pipeline_history')
    .select('*')
    .eq('pipeline_id', id)
    .order('changed_at', { ascending: false })
    .limit(20)

  const { data: memberships } = await supabase
    .from('content_pipeline_memberships')
    .select('collection_id, content_collections(id, code, name, type)')
    .eq('pipeline_id', id)

  const collections = memberships?.map((m: any) => m.content_collections).filter(Boolean) ?? []

  return (
    <>
      <CmsTopbar title={item.title_pt || item.title_en || item.code} />
      <PipelineItemDetail item={item} collections={collections} history={history ?? []} />
    </>
  )
}
