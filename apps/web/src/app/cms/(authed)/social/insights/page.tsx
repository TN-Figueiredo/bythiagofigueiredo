import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { getSocialStrings } from '../_i18n'
import { InsightsOverview } from './_components/insights-overview'
import { InsightsBestOf } from './_components/insights-best-of'
import { InsightsHealth } from './_components/insights-health'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function SocialInsightsPage({ searchParams }: Props) {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const uiLocale = ctx.defaultLocale === 'pt-BR' ? 'pt-BR' : 'en'
  const t = getSocialStrings(uiLocale)
  const params = await searchParams
  const tab = params.tab ?? 'overview'

  const data = {
    kpis: { postsPublished: 0, deliverySuccessRate: 0, linkClicks: 0, avgEngagement: 0, aiDraftsApproved: 0 },
    chartData: [] as { date: string; clicks: number; engagement: number; posts: number }[],
    heatmapData: [] as { day: number; hour: number; value: number }[],
  }

  return (
    <>
      <CmsTopbar title={t.insights.title} />
      <div className="p-6 space-y-6">
        <div className="flex gap-2 border-b border-cms-border pb-2">
          {(['overview', 'best-of', 'platform-health'] as const).map(tabId => {
            const tabKey = tabId === 'best-of' ? 'bestOf' : tabId === 'platform-health' ? 'platformHealth' : 'overview'
            return (
              <a
                key={tabId}
                href={tabId === 'overview' ? '/cms/social/insights' : `/cms/social/insights?tab=${tabId}`}
                className={`px-3 py-1.5 text-sm font-medium ${tab === tabId ? 'text-cms-accent border-b-2 border-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
              >
                {t.insights.tabs[tabKey]}
              </a>
            )
          })}
        </div>

        {tab === 'overview' && <InsightsOverview data={data} strings={t} />}
        {tab === 'best-of' && <InsightsBestOf topThumbnails={[]} topTitles={[]} topPosts={[]} strings={t} />}
        {tab === 'platform-health' && <InsightsHealth connections={[]} strings={t} />}
      </div>
    </>
  )
}
