import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { redirect } from 'next/navigation'
import { fetchYtChannelMetrics, fetchYtDailyMetrics } from '@/lib/youtube/analytics-client'
import {
  fetchVideoGrades,
  getCachedYtSearchTerms,
  getCachedYtDemographics,
} from '@/lib/youtube/analytics-queries'
import { YtAnalyticsTabs } from './_components/yt-analytics-tabs'

export default async function YouTubeAnalyticsPage() {
  const { siteId } = await getSiteContext()
  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const [metrics, dailyMetrics, grades, searchTerms, demographics] = await Promise.all([
    fetchYtChannelMetrics(siteId, 30),
    fetchYtDailyMetrics(siteId, 30),
    fetchVideoGrades(siteId),
    getCachedYtSearchTerms(siteId, 30),
    getCachedYtDemographics(siteId, 30),
  ])

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-cms-border p-12 text-center">
        <p className="text-sm text-cms-text-muted">No YouTube connection found.</p>
        <a
          href="/cms/social?tab=connections"
          className="text-sm font-medium text-[var(--acc)] hover:underline"
        >
          Connect YouTube →
        </a>
      </div>
    )
  }

  return (
    <YtAnalyticsTabs
      siteId={siteId}
      metrics={metrics}
      dailyMetrics={dailyMetrics}
      grades={grades}
      searchTerms={searchTerms}
      demographics={demographics}
    />
  )
}
