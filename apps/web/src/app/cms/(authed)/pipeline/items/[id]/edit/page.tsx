import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { PipelineBodyEditor } from '../../../_components/pipeline-body-editor'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'

export const dynamic = 'force-dynamic'

export default async function PipelineEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('id, code, format, body_content, version')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !item) notFound()

  return (
    <div className="gem-pipeline-theme h-full" style={GEM_CSS_VARS as React.CSSProperties}>
      <PipelineBodyEditor itemId={item.id} version={item.version} initialContent={item.body_content ?? ''} format={item.format} code={item.code} />
    </div>
  )
}
