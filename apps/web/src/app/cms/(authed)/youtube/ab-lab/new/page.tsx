import { getSiteContext } from '@/lib/cms/site-context'
import { getAbSiteSettings, getEligibleVideosForPicker } from '../queries'
import { NewTestClient } from './client'

export const dynamic = 'force-dynamic'

export default async function NewAbTestPage() {
  const { siteId } = await getSiteContext()
  const [settings, eligibleVideos] = await Promise.all([
    getAbSiteSettings(),
    getEligibleVideosForPicker(),
  ])

  return <NewTestClient siteId={siteId} settings={settings} eligibleVideos={eligibleVideos} />
}
