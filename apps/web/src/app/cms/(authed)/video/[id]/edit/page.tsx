import { notFound } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { loadVideoDetail } from '@/lib/pipeline/load-video-detail'
import { initialFromDetail } from './reducer'
import { VideoEditorClient } from './editor-client'

export const dynamic = 'force-dynamic'

export default async function VideoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!scope.ok) throw new Error('Forbidden')

  const detail = await loadVideoDetail(id, siteId)
  if (!detail) notFound()

  const primaryLang = detail.language === 'en' ? 'en' : 'pt'
  const initialState = initialFromDetail({
    itemId: detail.id,
    code: detail.code,
    siteId,
    stage: detail.stage,
    version: detail.version,
    primaryLang,
  })

  return (
    <VideoEditorClient
      initialState={initialState}
      initial={{
        ideia: detail.ideia,
        roteiro: detail.roteiro,
        pillar: detail.pillar,
        durationRange: detail.durationRange,
        sections: detail.sections,
        abJoinFacts: detail.abJoinFacts,
        // ab-lab winner is materialized post-publish; surfaced as null until joined (§3.8).
        winnerVariantId: null,
      }}
    />
  )
}
