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
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'

export const dynamic = 'force-dynamic'

export default async function AbLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const mockView = typeof sp.view === 'string' ? sp.view : undefined
  const { siteId } = await getSiteContext()

  if (mockView === 'empty') {
    return (
      <AbLabDashboard
        siteId={siteId}
        stats={{ activeTests: 0, avgConfidence: 0, winRate: 0, avgLift: 0, completedTests: 0, testsWon: 0 }}
        cards={[]}
        drafts={[]}
        completed={[]}
        learnings={null}
        suggested={[]}
        settings={AB_SITE_SETTINGS_DEFAULTS}
      />
    )
  }

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
