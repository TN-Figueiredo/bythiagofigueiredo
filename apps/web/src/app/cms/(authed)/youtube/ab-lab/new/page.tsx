import { getSiteContext } from '@/lib/cms/site-context'
import { getAbSiteSettings, getEligibleVideosForPicker, getAbDraftById } from '../queries'
import { NewTestClient } from './client'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ draft?: string }>
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

  return (
    <NewTestClient
      siteId={siteId}
      settings={settings}
      eligibleVideos={eligibleVideos}
      draftPrefill={draftData ?? undefined}
    />
  )
}
