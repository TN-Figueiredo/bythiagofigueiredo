import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineItemDetail } from '../../_components/pipeline-item-detail'
import { loadPipelineItemDetail } from '@/lib/pipeline/load-pipeline-detail'
import { resolvePipelineEditorTarget } from '@/lib/pipeline/editor-routing'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'

export const dynamic = 'force-dynamic'

export default async function PipelineItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })

  const { item, history, dependencies } = await loadPipelineItemDetail(id, siteId)

  // Blog items live in the staged editor now; only non-blog formats keep this view.
  // Linked items go straight to /edit (a page); unlinked blog items go through the
  // bridge route handler, which creates the post before redirecting.
  const editorTarget = resolvePipelineEditorTarget({ blog_post_id: item.blog_post_id ?? null, format: item.format })
  if (editorTarget.kind === 'edit') redirect(`/cms/blog/${editorTarget.postId}/edit`)
  if (editorTarget.kind === 'create') redirect(`/cms/blog/from-pipeline/${id}`)

  return (
    <>
      <CmsTopbar title={`Pipeline: ${item.title_pt || item.title_en || item.code}`} />
      <div className="gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineItemDetail item={item as any} history={history} dependencies={dependencies} />
      </div>
    </>
  )
}
