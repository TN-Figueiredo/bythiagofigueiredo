import { getSiteContext } from '@/lib/cms/site-context'
import {
  getAbTestsForSite,
  getAbSiteSettings,
  getLearnings,
  getSuggestedVideos,
  toCardView,
  toDraftList,
  computeDashboardStats,
} from './queries'
import { AbLabDashboard } from './_components/ab-lab-dashboard'
import { MOCK_DASHBOARD } from './_components/mock-dashboard'

export const dynamic = 'force-dynamic'

export default async function AbLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const mockView = typeof sp.view === 'string' ? sp.view : undefined

  if (mockView === 'full') {
    const { siteId } = await getSiteContext()
    return <AbLabDashboard siteId={siteId} {...MOCK_DASHBOARD} />
  }

  const { siteId } = await getSiteContext()
  const [tests, settings, learnings, suggested] = await Promise.all([
    getAbTestsForSite(),
    getAbSiteSettings(),
    getLearnings(siteId),
    getSuggestedVideos(siteId),
  ])

  const stats = computeDashboardStats(tests.active, tests.completed)
  const cards = tests.active.map(toCardView)
  const completedCards = tests.completed.map(toCardView)
  const drafts = toDraftList(tests.draft)

  return (
    <AbLabDashboard
      siteId={siteId}
      stats={stats}
      cards={cards}
      drafts={drafts}
      completed={completedCards}
      learnings={learnings}
      suggested={suggested}
      settings={settings}
    />
  )
}
