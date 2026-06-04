import { getSiteContext } from '@/lib/cms/site-context'
import {
  getAbTestsForSite,
  getAbSiteSettings,
  getChannelLearnings,
  getSuggestedVideos,
  getEligibleVideosForPicker,
  getFatigueAlerts,
  toCardView,
  toDraftList,
  computeDashboardStats,
} from './queries'
import { AbLabDashboard } from './_components/ab-lab-dashboard'

export const metadata = { title: 'A/B Lab' }

export const dynamic = 'force-dynamic'

export default async function AbLabPage() {
  const { siteId } = await getSiteContext()

  const [tests, settings, channelLearnings, suggested, eligibleVideos, fatigueAlerts] = await Promise.all([
    getAbTestsForSite(),
    getAbSiteSettings(),
    getChannelLearnings(siteId),
    getSuggestedVideos(siteId),
    getEligibleVideosForPicker(),
    getFatigueAlerts(siteId),
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
      learnings={channelLearnings?.combined ?? null}
      channelLearnings={channelLearnings}
      suggested={suggested}
      settings={settings}
      eligibleVideos={eligibleVideos}
      fatigueAlerts={fatigueAlerts}
    />
  )
}
