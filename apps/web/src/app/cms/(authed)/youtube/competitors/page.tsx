import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CompetitorDashboardV2 } from './_components/competitor-dashboard-v2'
import { useRedesignScreen } from '../_hooks/use-redesign-screen'
import type {
  CompetitorChannelView,
  CompetitorChangeView,
  CompetitorOutlierView,
  CompetitorInsights,
  CompetitorVideoView,
  OurChannelStats,
  ChangeFlag,
  VsYouComparison,
} from '@/lib/youtube/observatory-types'

export const dynamic = 'force-dynamic'

const MAX_CHANNELS = 15

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const validTabs = ['canais', 'mudancas', 'outliers', 'insights'] as const
  const activeTab = (validTabs.includes(tab as (typeof validTabs)[number]) ? tab : 'canais') as (typeof validTabs)[number]
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  // ── 1. Fetch competitor channels ──
  const { data: rawChannels } = await supabase
    .from('competitor_channels')
    .select('id, channel_id, channel_name, thumbnail_url, subscriber_count, last_synced_at, added_at')
    .eq('site_id', siteId)
    .order('added_at', { ascending: false })

  const safeChannels = rawChannels ?? []
  const channelIds = safeChannels.map(ch => ch.id)

  // ── 2. Fetch all videos (enriched with like_count, comment_count, duration, tags) ──
  const { data: allVideos } = channelIds.length > 0
    ? await supabase
        .from('competitor_videos')
        .select('id, competitor_channel_id, video_id, title, thumbnail_url, view_count, published_at, tags, like_count, comment_count, duration_seconds')
        .in('competitor_channel_id', channelIds)
        .order('published_at', { ascending: false })
        .limit(750)
    : { data: [] as Array<{
        id: string; competitor_channel_id: string; video_id: string; title: string | null
        thumbnail_url: string | null; view_count: number | null; published_at: string | null
        tags: string[] | null; like_count: number | null; comment_count: number | null
        duration_seconds: number | null
      }> }

  // ── 3. Fetch changes ──
  const { data: rawChanges } = await supabase
    .from('competitor_changes')
    .select('id, change_type, old_title, new_title, old_thumbnail_url, new_thumbnail_url, view_count_at_change, detected_at, bookmarked, competitor_videos!inner(title, video_id, competitor_channels!inner(channel_name, thumbnail_url))')
    .eq('site_id', siteId)
    .order('detected_at', { ascending: false })
    .limit(50)

  // ── 4. Fetch channel snapshots for sparklines ──
  const { data: snapshots } = channelIds.length > 0
    ? await supabase
        .from('competitor_channel_snapshots')
        .select('competitor_channel_id, subscriber_count, snapshot_date')
        .in('competitor_channel_id', channelIds)
        .order('snapshot_date', { ascending: true })
        .limit(500)
    : { data: [] as Array<{ competitor_channel_id: string; subscriber_count: number | null; snapshot_date: string }> }

  // ── 5. Fetch own channel stats ──
  const { data: ownChannels } = await supabase
    .from('youtube_channels')
    .select('id, subscriber_count, video_count')
    .eq('site_id', siteId)
    .limit(1)

  const { data: ownVideos } = await supabase
    .from('youtube_videos')
    .select('view_count, like_count, comment_count, published_at')
    .eq('site_id', siteId)
    .eq('is_hidden', false)
    .order('published_at', { ascending: false })
    .limit(100)

  // ── Compute own stats ──
  const ownChannel = ownChannels?.[0]
  const ownVids = ownVideos ?? []
  const ownTotalViews = ownVids.reduce((s, v) => s + (v.view_count ?? 0), 0)
  const ownAvgViews = ownVids.length > 0 ? Math.round(ownTotalViews / ownVids.length) : 0
  const ownTotalEngagement = ownVids.reduce((s, v) => s + (v.like_count ?? 0) + (v.comment_count ?? 0), 0)
  const ownEngRate = ownTotalViews > 0 ? ownTotalEngagement / ownTotalViews : 0

  // Upload frequency (videos per month over last 90 days)
  const ninetyDaysAgo = Date.now() - 90 * 86_400_000
  const recentOwnVids = ownVids.filter(v => v.published_at && new Date(v.published_at).getTime() > ninetyDaysAgo)
  const ownUploadFreq = recentOwnVids.length > 0 ? (recentOwnVids.length / 3) : 0

  const ourStats: OurChannelStats = {
    subscriberCount: ownChannel?.subscriber_count ?? 0,
    avgViews: ownAvgViews,
    engagementRate: ownEngRate,
    uploadFrequency: Math.round(ownUploadFreq * 10) / 10,
  }

  // ── Group videos by channel ──
  const videosByChannel = new Map<string, NonNullable<typeof allVideos>>()
  for (const v of allVideos ?? []) {
    const list = videosByChannel.get(v.competitor_channel_id) ?? []
    list.push(v)
    videosByChannel.set(v.competitor_channel_id, list)
  }

  // ── Group snapshots by channel ──
  const snapshotsByChannel = new Map<string, Array<{ subscriber_count: number | null; snapshot_date: string }>>()
  for (const s of snapshots ?? []) {
    const list = snapshotsByChannel.get(s.competitor_channel_id) ?? []
    list.push(s)
    snapshotsByChannel.set(s.competitor_channel_id, list)
  }

  // ── Group changes by video_id for change flags ──
  const changesByVideo = new Map<string, Array<{ change_type: string; detected_at: string }>>()
  for (const c of rawChanges ?? []) {
    const vidId = (c.competitor_videos as Array<{ video_id: string }>)?.[0]?.video_id
    if (!vidId) continue
    const list = changesByVideo.get(vidId) ?? []
    list.push({ change_type: c.change_type, detected_at: c.detected_at })
    changesByVideo.set(vidId, list)
  }

  // ── Build enriched channel views ──
  const channels: CompetitorChannelView[] = safeChannels.map(ch => {
    const videos = videosByChannel.get(ch.id) ?? []
    const snaps = snapshotsByChannel.get(ch.id) ?? []

    // Engagement rate
    const totalEngagement = videos.reduce((s, v) => s + (v.like_count ?? 0) + (v.comment_count ?? 0), 0)
    const totalViews = videos.reduce((s, v) => s + (v.view_count ?? 0), 0)
    const avgEngagement = totalViews > 0 ? totalEngagement / totalViews : null

    // Growth sparkline from snapshots
    const growthSparkline = snaps
      .slice(-30)
      .map(s => s.subscriber_count ?? 0)

    // Growth delta
    let growthDelta: number | null = null
    if (growthSparkline.length >= 2) {
      const last = growthSparkline[growthSparkline.length - 1] ?? 0
      const first = growthSparkline[0] ?? 0
      growthDelta = last - first
    }

    // vs-you comparison
    const chAvgViews = videos.length > 0 ? Math.round(totalViews / videos.length) : 0
    const recentVids = videos.filter(v => v.published_at && new Date(v.published_at).getTime() > ninetyDaysAgo)
    const chUploadFreq = recentVids.length > 0 ? recentVids.length / 3 : 0

    const vsYou: VsYouComparison | null = ourStats.subscriberCount > 0 ? {
      subsDelta: (ch.subscriber_count ?? 0) - ourStats.subscriberCount,
      engagementDelta: (avgEngagement ?? 0) - ourStats.engagementRate,
      avgViewsDelta: chAvgViews - ourStats.avgViews,
      frequencyDelta: Math.round((chUploadFreq - ourStats.uploadFrequency) * 10) / 10,
    } : null

    // Change flags (recent changes per type for this channel's videos)
    const channelVideoIds = new Set(videos.map(v => v.video_id))
    const flagMap = new Map<string, ChangeFlag>()
    for (const [vidId, changes] of changesByVideo) {
      if (!channelVideoIds.has(vidId)) continue
      for (const c of changes) {
        const t = c.change_type as 'title' | 'thumbnail' | 'description'
        const existing = flagMap.get(t)
        if (existing) {
          existing.count++
          if (c.detected_at > existing.latestAt) existing.latestAt = c.detected_at
        } else {
          flagMap.set(t, { type: t, count: 1, latestAt: c.detected_at })
        }
      }
    }
    const changeFlags = [...flagMap.values()]

    // Recent videos as CompetitorVideoView
    const medianViews = videos.length > 0
      ? [...videos].sort((a, b) => (a.view_count ?? 0) - (b.view_count ?? 0))[Math.floor(videos.length / 2)]?.view_count ?? 0
      : 0

    const recentVideos: CompetitorVideoView[] = videos.map(v => {
      const vc = v.view_count ?? 0
      const mult = medianViews > 0 ? vc / medianViews : null
      return {
        id: v.id,
        videoId: v.video_id,
        title: v.title,
        thumbnailUrl: v.thumbnail_url,
        viewCount: vc,
        likeCount: v.like_count ?? 0,
        commentCount: v.comment_count ?? 0,
        publishedAt: v.published_at,
        durationSeconds: v.duration_seconds ?? null,
        viewDelta: null,
        outlierMultiplier: mult != null && mult >= 2 ? mult : null,
        outlierTier: mult != null && mult >= 10 ? 'top' : mult != null && mult >= 5 ? 'high' : mult != null && mult >= 2 ? 'mid' : null,
      }
    })

    return {
      id: ch.id,
      channelId: ch.channel_id,
      channelName: ch.channel_name,
      thumbnailUrl: ch.thumbnail_url,
      subscriberCount: ch.subscriber_count,
      videoCount: videos.length,
      addedAt: ch.added_at ?? new Date().toISOString(),
      lastSyncedAt: ch.last_synced_at,
      avgEngagement,
      growthDelta,
      growthSparkline,
      recentVideos,
      vsYou,
      changeFlags,
    }
  })

  // ── Build changes views ──
  const changes: CompetitorChangeView[] = (rawChanges ?? []).map(c => {
    const vidInfo = (c.competitor_videos as Array<{ title: string | null; video_id: string; competitor_channels: Array<{ channel_name: string; thumbnail_url: string | null }> }>)?.[0]
    const chInfo = vidInfo?.competitor_channels?.[0]
    return {
      id: c.id,
      videoId: vidInfo?.video_id ?? '',
      videoTitle: vidInfo?.title ?? null,
      channelName: chInfo?.channel_name ?? '',
      channelThumbnailUrl: chInfo?.thumbnail_url ?? null,
      changeType: c.change_type as 'title' | 'thumbnail' | 'description',
      oldTitle: c.old_title,
      newTitle: c.new_title,
      oldThumbnailUrl: c.old_thumbnail_url,
      newThumbnailUrl: c.new_thumbnail_url,
      viewCountAtChange: c.view_count_at_change,
      detectedAt: c.detected_at,
      bookmarked: c.bookmarked,
      history: [], // TODO: fetch full history per video if needed
    }
  })

  // ── Build outlier views ──
  const outliers: CompetitorOutlierView[] = []
  for (const ch of safeChannels) {
    const videos = videosByChannel.get(ch.id) ?? []
    if (videos.length < 3) continue
    const sortedViews = [...videos]
      .map(v => v.view_count ?? 0)
      .sort((a, b) => a - b)
    const median = sortedViews[Math.floor(sortedViews.length / 2)]
    if (median <= 0) continue

    for (const v of videos) {
      const vc = v.view_count ?? 0
      const mult = vc / median
      if (mult >= 2.0) {
        outliers.push({
          id: v.id,
          videoId: v.video_id,
          title: v.title,
          thumbnailUrl: v.thumbnail_url,
          channelName: ch.channel_name,
          viewCount: vc,
          publishedAt: v.published_at,
          multiplier: Math.round(mult * 10) / 10,
          tier: mult >= 10 ? 'top' : mult >= 5 ? 'high' : 'mid',
        })
      }
    }
  }
  outliers.sort((a, b) => b.multiplier - a.multiplier)

  // ── Build insights ──
  const flatVideos = allVideos ?? []

  // Heatmap: 7x24 (day-of-week x hour)
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  const heatmapCounts: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (const v of flatVideos) {
    if (!v.published_at) continue
    const d = new Date(v.published_at)
    // JS getDay: 0=Sun, we want 0=Mon
    const dayIdx = (d.getDay() + 6) % 7
    const hourIdx = d.getHours()
    const dayRow = heatmap[dayIdx]
    const countRow = heatmapCounts[dayIdx]
    if (dayRow && countRow) {
      dayRow[hourIdx] = (dayRow[hourIdx] ?? 0) + (v.view_count ?? 0)
      countRow[hourIdx] = (countRow[hourIdx] ?? 0) + 1
    }
  }
  // Average views per slot
  for (let d = 0; d < 7; d++) {
    const dayRow = heatmap[d]
    const countRow = heatmapCounts[d]
    if (!dayRow || !countRow) continue
    for (let h = 0; h < 24; h++) {
      const cnt = countRow[h] ?? 0
      if (cnt > 0) {
        dayRow[h] = Math.round((dayRow[h] ?? 0) / cnt)
      }
    }
  }

  // Tags
  const tagStats = new Map<string, { count: number; totalViews: number }>()
  for (const v of flatVideos) {
    const tags = (v.tags as string[] | null) ?? []
    for (const tag of tags) {
      const s = tagStats.get(tag) ?? { count: 0, totalViews: 0 }
      s.count++
      s.totalViews += v.view_count ?? 0
      tagStats.set(tag, s)
    }
  }
  const tagsSorted = [...tagStats.entries()]
    .map(([tag, s]) => ({ tag, count: s.count, avgViews: s.count > 0 ? Math.round(s.totalViews / s.count) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // Engagement comparison
  const engagement = safeChannels
    .filter(ch => (videosByChannel.get(ch.id) ?? []).length > 0)
    .map(ch => {
      const vids = videosByChannel.get(ch.id) ?? []
      const totalV = vids.reduce((s, v) => s + (v.view_count ?? 0), 0)
      const totalE = vids.reduce((s, v) => s + (v.like_count ?? 0) + (v.comment_count ?? 0), 0)
      return {
        channelName: ch.channel_name,
        channelThumbnailUrl: ch.thumbnail_url,
        engagementRate: totalV > 0 ? totalE / totalV : 0,
        isUs: false,
      }
    })
    .sort((a, b) => b.engagementRate - a.engagementRate)

  // Insert our channel into engagement list
  engagement.push({
    channelName: 'Você',
    channelThumbnailUrl: null,
    engagementRate: ourStats.engagementRate,
    isUs: true,
  })
  engagement.sort((a, b) => b.engagementRate - a.engagementRate)

  // Gaps: topics competitors cover (approximate — own video tags not fetched)
  const gaps = tagsSorted.slice(0, 10).map(t => ({
    topic: t.tag,
    competitorCount: t.count,
    avgViews: t.avgViews,
    weCover: false, // simplified — would need own video tags
  }))

  const insights: CompetitorInsights = {
    heatmap,
    tags: tagsSorted,
    engagement,
    gaps,
  }

  const useV2 = useRedesignScreen('competitors')

  if (!useV2) {
    return (
      <div className="p-8 text-center text-cms-text-muted text-sm">
        <p>Redesign desabilitado para esta tela via <code className="mono">YT_REDESIGN_SCREENS</code>.</p>
      </div>
    )
  }

  return (
    <CompetitorDashboardV2
      channels={channels}
      changes={changes}
      outliers={outliers}
      insights={insights}
      ourStats={ourStats}
      maxChannels={MAX_CHANNELS}
      activeTab={activeTab}
    />
  )
}
