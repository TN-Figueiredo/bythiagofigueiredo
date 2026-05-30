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
        suggested={[
          { id: 'sug-1', title: '🇹🇭 Andei de Tuk-Tuk a 80km/h em Bangkok', thumbnailUrl: null, ctr: 3.1, channelMedianCtr: 5.4, grade: 'D', reason: 'CTR 43% abaixo da mediana do canal há 2 semanas', suggest: 'combo', impressions: '8.2k', confidence: 88 },
          { id: 'sug-2', title: '🇹🇭 Quanto Custa 1 Semana na Tailândia em 2026', thumbnailUrl: null, ctr: 4.2, channelMedianCtr: 5.4, grade: 'C', reason: 'Bom tema, CTR mediano — thumb não está vendendo o valor', suggest: 'thumbnail', impressions: '14.3k', confidence: 79 },
          { id: 'sug-3', title: '🇹🇭 Templos Escondidos que Ninguém Te Mostra', thumbnailUrl: null, ctr: 4.6, channelMedianCtr: 5.4, grade: 'C', reason: 'Retenção alta (51%) mas poucos cliques — título genérico', suggest: 'title', impressions: '6.1k', confidence: 74 },
        ]}
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
