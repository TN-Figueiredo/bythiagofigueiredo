import { getSiteContext } from '@/lib/cms/site-context'
import {
  getAbTestsForSite,
  getAbSiteSettings,
  getLearnings,
  getSuggestedVideos,
  getEligibleVideosForPicker,
  toCardView,
  toDraftList,
  computeDashboardStats,
} from './queries'
import { AbLabDashboard } from './_components/ab-lab-dashboard'

export const dynamic = 'force-dynamic'

export default async function AbLabPage() {
  const { siteId } = await getSiteContext()

  const [tests, settings, learnings, suggested, eligibleVideos] = await Promise.all([
    getAbTestsForSite(),
    getAbSiteSettings(),
    getLearnings(siteId),
    getSuggestedVideos(siteId),
    getEligibleVideosForPicker(),
  ])

  const stats = computeDashboardStats(tests.active, tests.completed)
  const cards = tests.active.map(toCardView)
  const completedCards = tests.completed.map(toCardView)
  const pausedCards = tests.paused.map(toCardView)
  const drafts = toDraftList(tests.draft)

  return (
    <AbLabDashboard
      siteId={siteId}
      stats={stats}
      cards={cards}
      drafts={drafts}
      completed={completedCards}
      paused={pausedCards}
      learnings={learnings}
      suggested={suggested}
      settings={settings}
      eligibleVideos={eligibleVideos}
    />
  )
}
