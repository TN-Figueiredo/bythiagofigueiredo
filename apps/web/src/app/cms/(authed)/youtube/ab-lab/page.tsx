import { getSiteContext } from '@/lib/cms/site-context'
import { getAbTestsForSite, getAbSiteSettings, getEligibleVideosForPicker } from './queries'
import { AbLabDashboard } from './_components/ab-lab-dashboard'

export const dynamic = 'force-dynamic'

export default async function AbLabPage() {
  const { siteId } = await getSiteContext()
  const [tests, settings, eligibleVideos] = await Promise.all([
    getAbTestsForSite(),
    getAbSiteSettings(),
    getEligibleVideosForPicker(),
  ])

  return (
    <AbLabDashboard
      siteId={siteId}
      active={tests.active}
      draft={tests.draft}
      completed={tests.completed}
      settings={settings}
      eligibleVideos={eligibleVideos}
    />
  )
}
