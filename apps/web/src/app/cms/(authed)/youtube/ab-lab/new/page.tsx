import { getSiteContext } from '@/lib/cms/site-context'
import { getAbSiteSettings, getEligibleVideosForPicker, getAbDraftById } from '../queries'
import { NewTestClient } from './client'
import type { CompetitorContext } from './client'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    draft?: string
    ref?: string
    changeType?: string
    competitorThumb?: string
    competitorTitle?: string
  }>
}

export default async function NewAbTestPage({ searchParams }: Props) {
  const { siteId } = await getSiteContext()
  const params = await searchParams
  const draftId = params.draft

  const [settings, eligibleVideos, draftData] = await Promise.all([
    getAbSiteSettings(),
    getEligibleVideosForPicker(),
    draftId ? getAbDraftById(draftId) : Promise.resolve(null),
  ])

  const competitorContext: CompetitorContext | undefined =
    params.ref === 'competitor'
      ? {
          changeType: (params.changeType as 'thumbnail' | 'title') ?? undefined,
          competitorThumb: params.competitorThumb ?? undefined,
          competitorTitle: params.competitorTitle ?? undefined,
        }
      : undefined

  return (
    <NewTestClient
      siteId={siteId}
      settings={settings}
      eligibleVideos={eligibleVideos}
      draftPrefill={draftData ?? undefined}
      competitorContext={competitorContext}
    />
  )
}
