import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { fetchYtChannelMetrics, fetchYtDailyMetrics, getConnectedYouTubeChannels } from '@/lib/youtube/analytics-client'
import {
  fetchVideoGrades,
  getCachedYtSearchTerms,
  getCachedYtDemographics,
} from '@/lib/youtube/analytics-queries'
import {
  fetchGradesData,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  requestIntelligenceAnalysis,
} from './actions'
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
        <p className="text-sm text-cms-text-muted">Nenhuma conexão YouTube encontrada.</p>
        <a
          href="/cms/social?tab=connections"
          className="text-sm font-medium text-[var(--acc)] hover:underline"
        >
          Conectar YouTube →
        </a>
      </div>
    )
  }

  const { channel: selectedChannelId } = await searchParams
  const activeChannel = channels.find(c => c.channelId === selectedChannelId) ?? channels[0]!

  const supabaseForLastAnalysis = getSupabaseServiceClient()
  const [metrics, dailyMetrics, grades, searchTermsResult, demographicsResult, intelligenceData, notifications, lastAnalysisRow] = await Promise.all([
    fetchYtChannelMetrics(siteId, 30, activeChannel.channelId),
    fetchYtDailyMetrics(siteId, 30, activeChannel.channelId),
    fetchVideoGrades(siteId, activeChannel.internalId),
    getCachedYtSearchTerms(siteId, 90, activeChannel.channelId),
    getCachedYtDemographics(siteId, 90, activeChannel.channelId),
    fetchGradesData(activeChannel.internalId).catch(() => ({ videos: [], outliers: [] })),
    fetchNotifications().catch(() => []),
    supabaseForLastAnalysis
      .from('youtube_intelligence_tasks')
      .select('completed_at')
      .eq('site_id', siteId)
      .eq('channel_id', activeChannel.internalId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(r => r.data, () => null),
  ])

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-cms-border p-12 text-center">
        <p className="text-sm text-cms-text-muted">
          Não foi possível carregar analytics para este canal. A API do YouTube Analytics pode levar 48-72 horas para disponibilizar dados de canais recém-conectados.
        </p>
      </div>
    )
  }

  const healthScore = intelligenceData.videos.length > 0
    ? Math.round(intelligenceData.videos.reduce((s, v) => s + v.score, 0) / intelligenceData.videos.length)
    : 0

  const videoMap = new Map(intelligenceData.videos.map(v => [v.videoId, v]))
  const enrichedOutliers = intelligenceData.outliers.map(o => ({
    ...o,
    title: videoMap.get(o.videoId)?.title ?? '',
    score: videoMap.get(o.videoId)?.score ?? 0,
  }))

  return (
    <YtAnalyticsTabs
      metrics={metrics}
      dailyMetrics={dailyMetrics}
      grades={grades}
      searchTerms={searchTermsResult.data}
      demographics={demographicsResult.data}
      searchTermsError={searchTermsResult.error}
      demographicsError={demographicsResult.error}
      channels={channels}
      activeChannelId={activeChannel.channelId}
      channelInternalId={activeChannel.internalId}
      intelligenceVideos={intelligenceData.videos}
      intelligenceOutliers={enrichedOutliers}
      notifications={notifications}
      healthScore={healthScore}
      lastAnalysisAt={lastAnalysisRow?.completed_at ?? null}
      onMarkNotificationRead={markNotificationRead}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onDismissNotification={dismissNotification}
      onRequestAnalysis={requestIntelligenceAnalysis}
    />
  )
}
