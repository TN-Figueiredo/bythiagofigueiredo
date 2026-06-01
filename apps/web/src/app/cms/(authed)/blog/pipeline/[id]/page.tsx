import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { PipelineItemDetail } from '../../../pipeline/_components/pipeline-item-detail'
import { loadPipelineItemDetail } from '@/lib/pipeline/load-pipeline-detail'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'

export const dynamic = 'force-dynamic'

export default async function BlogPipelineItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })

  const { item, history, dependencies } = await loadPipelineItemDetail(id, siteId)

  return (
    <>
      <CmsTopbar title={`Blog > Pipeline: ${item.title_pt || item.title_en || item.code}`} />
      <div className="gem-pipeline-theme" style={GEM_CSS_VARS as React.CSSProperties}>
        <PipelineItemDetail item={item as any} history={history} dependencies={dependencies} />
      </div>
    </>
  )
}
