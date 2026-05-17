import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { redirect } from 'next/navigation'
import { fetchYtChannelMetrics, fetchYtDailyMetrics, getConnectedYouTubeChannels } from '@/lib/youtube/analytics-client'
import {
  fetchVideoGrades,
  getCachedYtSearchTerms,
  getCachedYtDemographics,
} from '@/lib/youtube/analytics-queries'
import { YtAnalyticsTabs } from './_components/yt-analytics-tabs'

export const dynamic = 'force-dynamic'

export default async function YouTubeAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>
}) {
  const { siteId } = await getSiteContext()
  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const channels = await getConnectedYouTubeChannels(siteId)

  if (channels.length === 0) {
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

  const { channel: selectedChannelId } = await searchParams
  const activeChannel = channels.find(c => c.channelId === selectedChannelId) ?? channels[0]!

  const [metrics, dailyMetrics, grades, searchTerms, demographics] = await Promise.all([
    fetchYtChannelMetrics(siteId, 30, activeChannel.channelId),
    fetchYtDailyMetrics(siteId, 30, activeChannel.channelId),
    fetchVideoGrades(siteId, activeChannel.internalId),
    getCachedYtSearchTerms(siteId, 30, activeChannel.channelId),
    getCachedYtDemographics(siteId, 30, activeChannel.channelId),
  ])

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-cms-border p-12 text-center">
        <p className="text-sm text-cms-text-muted">
          Could not fetch analytics for this channel. The YouTube Analytics API may take 48-72 hours to provide data for newly connected channels.
        </p>
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
      channels={channels}
      activeChannelId={activeChannel.channelId}
    />
  )
}
