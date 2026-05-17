import { getSiteContext } from '@/lib/cms/site-context'
import { getAbTestsForSite, getAbSiteSettings } from './actions'
import { AbLabDashboard } from './_components/ab-lab-dashboard'

export const dynamic = 'force-dynamic'

export default async function AbLabPage() {
  const { siteId } = await getSiteContext()
  const [tests, settings] = await Promise.all([
    getAbTestsForSite(),
    getAbSiteSettings(),
  ])

  return (
    <AbLabDashboard
      siteId={siteId}
      active={tests.active}
      draft={tests.draft}
      completed={tests.completed}
      settings={settings}
    />
  )
}
