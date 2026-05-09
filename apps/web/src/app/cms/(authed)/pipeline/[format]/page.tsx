import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { FORMATS, type Format } from '@/lib/pipeline/schemas'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineBoard } from '../_components/pipeline-board'

export const dynamic = 'force-dynamic'

export default async function FormatBoardPage({ params }: { params: Promise<{ format: string }> }) {
  const { format } = await params
  if (!FORMATS.includes(format as Format)) notFound()

  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: items } = await supabase
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, stage, priority, language, tags, production_checklist, version, format')
    .eq('site_id', siteId)
    .eq('format', format)
    .eq('is_archived', false)
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false })

  const labels: Record<string, string> = {
    video: 'Video', blog_post: 'Blog', newsletter: 'Newsletter', course: 'Course', campaign: 'Campaign',
  }

  return (
    <>
      <CmsTopbar title={`Pipeline: ${labels[format]}`} />
      <div className="p-4">
        <PipelineBoard format={format as Format} items={items ?? []} />
      </div>
    </>
  )
}
