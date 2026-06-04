import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CompetitorDashboardV2 } from './_components/competitor-dashboard-v2'
import { computeViewGrowthSparkline } from '@/lib/youtube/sparkline-math'
import { computeGrowthScore } from '@/lib/youtube/growth-score'
import { getSubscriberBounds } from '@/lib/youtube/subscriber-resolution'
import type {
  CompetitorChannelView,
  CompetitorChangeView,
  CompetitorOutlierView,
  CompetitorInsights,
  CompetitorVideoView,
  OurChannelStats,
  ChangeFlag,
  VsYouEntry,
  CadenceChannel,
  CadenceVideo,
  TitleFormula,
  PlayOfTheWeek,
} from '@/lib/youtube/observatory-types'

export const metadata = { title: 'Competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_CHANNELS = 15

const CHANNEL_COLORS = [
  'rgb(232, 130, 60)', 'rgb(167, 124, 232)', 'rgb(63, 169, 192)',
  'rgb(217, 97, 74)', 'rgb(96, 165, 250)', 'rgb(70, 177, 126)',
  'rgb(224, 162, 60)', 'rgb(190, 90, 150)', 'rgb(120, 180, 80)',
]

const BR_DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const

const FORMULA_PATTERNS: Array<{ label: string; hint: string; test: (t: string) => boolean }> = [
  { label: 'Nome do lugar', hint: 'o estrangeiro nítido', test: t => /\b(bangkok|tailândia|vietnam|vietnã|japão|tóquio|coreia|seul|bali|índia|filipinas|china|asia|ásia|europa|delhi|hanói)\b/i.test(t) },
  { label: 'Primeira pessoa', hint: '"larguei tudo"', test: t => /^(eu |fui |larguei |cheguei |morei |voltei |tentei |decidi |saí )/i.test(t) },
  { label: 'Preço em R$', hint: 'o número que dói', test: t => /R\$\s*[\d.,]+|por apenas|custou/i.test(t) },
  { label: 'Em dólar', hint: 'arbitragem de moeda', test: t => /dólar|dollar|ganhando em/i.test(t) },
  { label: 'Número/lista', hint: 'concretude', test: t => /^\d+\s|TOP \d|\d+ (coisas|razões|motivos|dicas|erros|lugares)/i.test(t) },
  { label: 'Passaporte BR · solo', hint: 'flex geográfico', test: t => /passaporte|sozinho|solo/i.test(t) && /brasil|brasileiro/i.test(t) },
]

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
    .select('id, channel_id, channel_name, thumbnail_url, subscriber_count, last_synced_at, added_at, sync_mode, sync_status, sync_started_at, sync_progress, sync_error, full_sync_completed_at, youtube_video_count, video_limit')
    .eq('site_id', siteId)
    .order('added_at', { ascending: false })

  const safeChannels = rawChannels ?? []
  const channelIds = safeChannels.map(ch => ch.id)

  // ── 2. Fetch videos per-channel (respects per-channel video_limit, default 50, max 200) ──
  type VideoRow = {
    id: string; competitor_channel_id: string; video_id: string; title: string | null
    thumbnail_url: string | null; view_count: number | null; published_at: string | null
    tags: string[] | null; like_count: number | null; comment_count: number | null
    duration_seconds: number | null; last_checked_at: string | null
  }
  const videoLimitByChannel = new Map(safeChannels.map(ch => [ch.id, Math.min(ch.video_limit ?? 50, 200)]))
  const allVideos: VideoRow[] = []
  for (const chId of channelIds) {
    const limit = videoLimitByChannel.get(chId) ?? 50
    const { data: chVideos } = await supabase
      .from('competitor_videos')
      .select('id, competitor_channel_id, video_id, title, thumbnail_url, view_count, published_at, tags, like_count, comment_count, duration_seconds, last_checked_at')
      .eq('competitor_channel_id', chId)
      .order('published_at', { ascending: false })
      .limit(limit)
    if (chVideos) allVideos.push(...(chVideos as VideoRow[]))
  }

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
        .select('competitor_channel_id, subscriber_count, view_count, video_count, snapshot_date')
        .in('competitor_channel_id', channelIds)
        .order('snapshot_date', { ascending: true })
        .limit(500)
    : { data: [] as Array<{ competitor_channel_id: string; subscriber_count: number | null; view_count: number | null; video_count: number | null; snapshot_date: string }> }

  // ── 5. Fetch own channel stats (ALL channels) ──
  const { data: ownChannels } = await supabase
    .from('youtube_channels')
    .select('id, name, channel_id, subscriber_count, video_count')
    .eq('site_id', siteId)

  const { data: ownVideos } = await supabase
    .from('youtube_videos')
    .select('view_count, like_count, comment_count, published_at, channel_id, tags')
    .eq('site_id', siteId)
    .eq('is_hidden', false)
    .order('published_at', { ascending: false })
    .limit(200)

  // ── Compute per-channel own stats ──
  const ninetyDaysAgo = Date.now() - 90 * 86_400_000
  const ownVideosByChannel = new Map<string, NonNullable<typeof ownVideos>>()
  for (const v of ownVideos ?? []) {
    const chId = (v as { channel_id?: string }).channel_id
    if (!chId) continue
    const list = ownVideosByChannel.get(chId) ?? []
    list.push(v)
    ownVideosByChannel.set(chId, list)
  }

  interface OwnChannelComputed {
    id: string
    name: string
    channelId: string
    subscriberCount: number
    avgViews: number
    engagementRate: number
    uploadFrequency: number
  }

  const ourChannels: OwnChannelComputed[] = (ownChannels ?? []).map(ch => {
    const vids = ownVideosByChannel.get(ch.id) ?? []
    const totalViews = vids.reduce((s, v) => s + (v.view_count ?? 0), 0)
    const avg = vids.length > 0 ? Math.round(totalViews / vids.length) : 0
    const totalEng = vids.reduce((s, v) => s + (v.like_count ?? 0) + (v.comment_count ?? 0), 0)
    const eng = totalViews > 0 ? totalEng / totalViews : 0
    const recent = vids.filter(v => v.published_at && new Date(v.published_at).getTime() > ninetyDaysAgo)
    const freq = recent.length > 0 ? recent.length / 3 : 0
    return {
      id: ch.id,
      name: ch.name ?? ch.channel_id ?? 'Canal',
      channelId: ch.channel_id ?? ch.id,
      subscriberCount: ch.subscriber_count ?? 0,
      avgViews: avg,
      engagementRate: eng,
      uploadFrequency: Math.round(freq * 10) / 10,
    }
  })

  // Aggregate stats for ourStats (used by insights engagement comparison)
  const allOwnVids = ownVideos ?? []
  const aggTotalViews = allOwnVids.reduce((s, v) => s + (v.view_count ?? 0), 0)
  const aggAvgViews = allOwnVids.length > 0 ? Math.round(aggTotalViews / allOwnVids.length) : 0
  const aggTotalEng = allOwnVids.reduce((s, v) => s + (v.like_count ?? 0) + (v.comment_count ?? 0), 0)
  const aggEngRate = aggTotalViews > 0 ? aggTotalEng / aggTotalViews : 0
  const aggRecentVids = allOwnVids.filter(v => v.published_at && new Date(v.published_at).getTime() > ninetyDaysAgo)
  const aggUploadFreq = aggRecentVids.length > 0 ? aggRecentVids.length / 3 : 0

  const ourStats: OurChannelStats = {
    subscriberCount: ourChannels.reduce((s, c) => s + c.subscriberCount, 0),
    avgViews: aggAvgViews,
    engagementRate: aggEngRate,
    uploadFrequency: Math.round(aggUploadFreq * 10) / 10,
  }

  // ── Group videos by channel ──
  const videosByChannel = new Map<string, VideoRow[]>()
  for (const v of allVideos) {
    const list = videosByChannel.get(v.competitor_channel_id) ?? []
    list.push(v)
    videosByChannel.set(v.competitor_channel_id, list)
  }

  // ── Group snapshots by channel ──
  const snapshotsByChannel = new Map<string, Array<{ subscriber_count: number | null; view_count: number | null; video_count: number | null; snapshot_date: string }>>()
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

    // Growth sparkline from snapshots (view-based, last 30 data points)
    const growthSparkline = computeViewGrowthSparkline(snaps)

    // Subscriber growth delta (may be 0 due to YouTube rounding)
    let subscriberGrowthDelta: number | null = null
    if (snaps.length >= 2) {
      const latest = snaps[snaps.length - 1]!
      const sevenDaysAgoStr = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
      const weekAgoSnap = snaps.reduce<(typeof snaps)[number] | null>((best, s) => {
        if (s.snapshot_date <= sevenDaysAgoStr) return s
        return best
      }, null) ?? snaps[0]!
      if (weekAgoSnap.snapshot_date !== latest.snapshot_date) {
        subscriberGrowthDelta = (latest.subscriber_count ?? 0) - (weekAgoSnap.subscriber_count ?? 0)
      }
    }

    // View growth delta (exact, not rounded by YouTube)
    let viewGrowthDelta: number | null = null
    if (snaps.length >= 2) {
      const latest = snaps[snaps.length - 1]!
      const sevenDaysAgoStr = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
      const weekAgoSnap = snaps.reduce<(typeof snaps)[number] | null>((best, s) => {
        if (s.snapshot_date <= sevenDaysAgoStr) return s
        return best
      }, null) ?? snaps[0]!
      if (weekAgoSnap.snapshot_date !== latest.snapshot_date) {
        viewGrowthDelta = (latest.view_count ?? 0) - (weekAgoSnap.view_count ?? 0)
      }
    }

    // Growth score (composite signal)
    const growthScore = computeGrowthScore({
      snapshots: snaps,
      videos: videos.map(v => ({
        view_count: v.view_count,
        like_count: v.like_count,
        comment_count: v.comment_count,
        published_at: v.published_at,
      })),
    })

    // View count momentum flag
    const viewCountGrowing = (() => {
      if (snaps.length < 2) return false
      const recent = snaps.slice(-7)
      if (recent.length < 2) return false
      return (recent[recent.length - 1]!.view_count ?? 0) > (recent[0]!.view_count ?? 0)
    })()

    const snapshotCount = snaps.length

    // vs-you comparison (one entry per own channel)
    const chAvgViews = videos.length > 0 ? Math.round(totalViews / videos.length) : 0
    const recentVids = videos.filter(v => v.published_at && new Date(v.published_at).getTime() > ninetyDaysAgo)
    const chUploadFreq = recentVids.length > 0 ? recentVids.length / 3 : 0

    const vsYou: VsYouEntry[] | null = ourChannels.length > 0
      ? ourChannels
          .filter(oc => oc.subscriberCount > 0)
          .map(oc => ({
            channelName: oc.name,
            channelId: oc.id,
            subsDelta: (ch.subscriber_count ?? 0) - oc.subscriberCount,
            engagementDelta: (avgEngagement ?? 0) - oc.engagementRate,
            avgViewsDelta: chAvgViews - oc.avgViews,
            frequencyDelta: Math.round((chUploadFreq - oc.uploadFrequency) * 10) / 10,
          }))
      : null
    const vsYouResult = vsYou && vsYou.length > 0 ? vsYou : null

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

    // Recent videos as CompetitorVideoView — exclude stale from median
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const freshForMedian = videos.filter(v => v.last_checked_at ? v.last_checked_at > sevenDaysAgo : true)
    const medianViews = freshForMedian.length > 0
      ? [...freshForMedian].sort((a, b) => (a.view_count ?? 0) - (b.view_count ?? 0))[Math.floor(freshForMedian.length / 2)]?.view_count ?? 0
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
      growthDelta: viewGrowthDelta,
      growthSparkline,
      recentVideos,
      vsYou: vsYouResult,
      changeFlags,
      syncMode: (ch.sync_mode ?? 'recent') as 'recent' | 'full',
      syncStatus: (ch.sync_status ?? 'idle') as 'idle' | 'syncing' | 'error',
      syncProgress: ch.sync_progress ?? 0,
      syncError: ch.sync_error ?? null,
      youtubeVideoCount: ch.youtube_video_count ?? null,
      fullSyncCompletedAt: ch.full_sync_completed_at ?? null,
      videoLimit: ch.video_limit ?? 50,
      growthScore,
      snapshotCount,
      viewCountGrowing,
      viewGrowthDelta,
      subscriberGrowthDelta,
    }
  })

  // ── Build changes views (grouped by video) ──
  type RawChange = NonNullable<typeof rawChanges>[number]
  const mapChange = (c: RawChange): CompetitorChangeView => {
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
      history: [],
    }
  }

  // Group raw changes by video_id (query already sorted by detected_at DESC)
  const changeGroupsByVideo = new Map<string, RawChange[]>()
  for (const c of rawChanges ?? []) {
    const vidId = (c.competitor_videos as Array<{ video_id: string }>)?.[0]?.video_id ?? ''
    if (!vidId) continue
    const group = changeGroupsByVideo.get(vidId) ?? []
    group.push(c)
    changeGroupsByVideo.set(vidId, group)
  }

  // First item in each group = parent, rest = history
  const changes: CompetitorChangeView[] = []
  for (const group of changeGroupsByVideo.values()) {
    const parent = mapChange(group[0]!)
    parent.history = group.slice(1).map(mapChange)
    changes.push(parent)
  }
  // Sort parents by detectedAt DESC
  changes.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))

  // ── Build outlier views ──
  const outlierStaleCutoff = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const outliers: CompetitorOutlierView[] = []
  for (const ch of safeChannels) {
    const videos = videosByChannel.get(ch.id) ?? []
    const freshVids = videos.filter(v => v.last_checked_at ? v.last_checked_at > outlierStaleCutoff : true)
    if (freshVids.length < 3) continue
    const sortedViews = [...freshVids]
      .map(v => v.view_count ?? 0)
      .sort((a, b) => a - b)
    const median = sortedViews[Math.floor(sortedViews.length / 2)] ?? 0
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
          channelThumbnailUrl: ch.thumbnail_url,
          viewCount: vc,
          likeCount: v.like_count ?? 0,
          commentCount: v.comment_count ?? 0,
          durationSeconds: v.duration_seconds ?? null,
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
  const tagStats = new Map<string, { count: number; totalViews: number; channels: Set<string> }>()
  const compTagsByChMap = new Map<string, Set<string>>()
  for (const v of flatVideos) {
    const tags = (v.tags as string[] | null) ?? []
    const chName = safeChannels.find(c => c.id === v.competitor_channel_id)?.channel_name ?? ''
    if (chName) {
      const chSet = compTagsByChMap.get(chName) ?? new Set<string>()
      for (const tag of tags) chSet.add(tag)
      compTagsByChMap.set(chName, chSet)
    }
    for (const tag of tags) {
      const s = tagStats.get(tag) ?? { count: 0, totalViews: 0, channels: new Set<string>() }
      s.count++
      s.totalViews += v.view_count ?? 0
      if (chName) s.channels.add(chName)
      tagStats.set(tag, s)
    }
  }
  const tagsSorted = [...tagStats.entries()]
    .map(([tag, s]) => ({ tag, count: s.count, avgViews: s.count > 0 ? Math.round(s.totalViews / s.count) : 0, channelNames: [...s.channels] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
  const competitorTagsByChannel = [...compTagsByChMap.entries()]
    .map(([channelName, tags]) => ({ channelName, tags: [...tags].slice(0, 15) }))
    .sort((a, b) => b.tags.length - a.tags.length)

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

  const ownTagSet = new Set<string>()
  const ownTagsByChannelMap = new Map<string, Set<string>>()
  for (const v of allOwnVids) {
    const vTags = (v as { tags?: string[] | null }).tags
    const chId = (v as { channel_id?: string }).channel_id
    if (!vTags || !chId) continue
    for (const t of vTags) ownTagSet.add(t.toLowerCase())
    const set = ownTagsByChannelMap.get(chId) ?? new Set<string>()
    for (const t of vTags) set.add(t.toLowerCase())
    ownTagsByChannelMap.set(chId, set)
  }
  const ownTagsByChannel = (ownChannels ?? []).map(ch => ({
    channelName: ch.name || ch.channel_id || ch.id,
    tags: [...(ownTagsByChannelMap.get(ch.id) ?? [])].slice(0, 15),
  }))

  const gaps = tagsSorted.slice(0, 10).map(t => ({
    topic: t.tag,
    competitorCount: t.count,
    avgViews: t.avgViews,
    weCover: ownTagSet.has(t.tag.toLowerCase()),
    channelNames: t.channelNames,
  }))

  // ── Cadence per channel ──
  const twentyOneDaysAgo = Date.now() - 21 * 86_400_000
  const cadence: CadenceChannel[] = safeChannels.map((ch, idx) => {
    const videos = videosByChannel.get(ch.id) ?? []
    const recentCadence = videos.filter(v => v.published_at && new Date(v.published_at).getTime() > twentyOneDaysAgo)
    const freq = Math.round((recentCadence.length / 3) * 10) / 10

    const slotCounts = new Map<string, number>()
    for (const v of videos) {
      if (!v.published_at) continue
      const d = new Date(v.published_at)
      const dayIdx = (d.getDay() + 6) % 7
      const slot = `${BR_DAY_NAMES[dayIdx]} ${d.getHours()}h`
      slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1)
    }
    let window = '—'
    let maxSlot = 0
    for (const [slot, count] of slotCounts) {
      if (count > maxSlot) { maxSlot = count; window = slot }
    }

    const cadenceVideos: CadenceVideo[] = videos
      .filter((v): v is VideoRow & { published_at: string } => v.published_at != null)
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .map(v => ({ title: v.title ?? '', viewCount: v.view_count ?? 0, publishedAt: v.published_at }))

    const lastUploadDays = cadenceVideos.length > 0
      ? Math.floor((Date.now() - new Date(cadenceVideos[0]!.publishedAt).getTime()) / 86_400_000)
      : -1

    return {
      channelName: ch.channel_name,
      channelId: ch.channel_id,
      color: CHANNEL_COLORS[idx % CHANNEL_COLORS.length]!,
      freq,
      window,
      videos: cadenceVideos,
      lastUploadDays,
    }
  })

  // ── Hits heatmap (outlier videos only: view_count > 2x channel median) ──
  const channelMedians = new Map<string, number>()
  for (const ch of safeChannels) {
    const videos = videosByChannel.get(ch.id) ?? []
    const freshVids = videos.filter(v => v.last_checked_at ? v.last_checked_at > outlierStaleCutoff : true)
    if (freshVids.length < 3) continue
    const sorted = [...freshVids].map(v => v.view_count ?? 0).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0
    if (median > 0) channelMedians.set(ch.id, median)
  }

  const hitsHeatmap: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (const v of flatVideos) {
    if (!v.published_at) continue
    const median = channelMedians.get(v.competitor_channel_id)
    if (median == null) continue
    if ((v.view_count ?? 0) <= 2 * median) continue
    const d = new Date(v.published_at)
    const dayIdx = (d.getDay() + 6) % 7
    const hourIdx = d.getHours()
    const dayRow = hitsHeatmap[dayIdx]
    if (dayRow) dayRow[hourIdx] = (dayRow[hourIdx] ?? 0) + 1
  }

  // ── Formulas (title pattern detection on outlier videos) ──
  const formulaAccum = new Map<string, { label: string; hint: string; totalMult: number; count: number; bestTitle: string; bestMult: number }>()
  for (const o of outliers) {
    const title = o.title ?? ''
    for (const p of FORMULA_PATTERNS) {
      if (!p.test(title)) continue
      const acc = formulaAccum.get(p.label) ?? { label: p.label, hint: p.hint, totalMult: 0, count: 0, bestTitle: '', bestMult: 0 }
      acc.totalMult += o.multiplier
      acc.count++
      if (o.multiplier > acc.bestMult) { acc.bestMult = o.multiplier; acc.bestTitle = title }
      formulaAccum.set(p.label, acc)
    }
  }
  const formulas: TitleFormula[] = [...formulaAccum.values()]
    .filter(f => f.count > 0)
    .map(f => ({
      label: f.label,
      hint: f.hint,
      multiplier: Math.round((f.totalMult / f.count) * 10) / 10,
      count: f.count,
      exampleTitle: f.bestTitle,
    }))
    .sort((a, b) => b.multiplier - a.multiplier)

  // ── Play (Jogada da Semana) ──
  let play: PlayOfTheWeek | null = null
  if (outliers.length >= 3 && formulas.length > 0) {
    const topicBold = gaps.find(g => !g.weCover)?.topic ?? tagsSorted[0]?.tag ?? ''
    const topFormula = formulas[0]!

    let windowBold = ''
    let windowReason = 'onde nascem os hits e o volume é fraco'
    let bestScore = Infinity
    for (let d = 0; d < 7; d++) {
      const heatRow = heatmap[d]
      const hitsRow = hitsHeatmap[d]
      if (!heatRow || !hitsRow) continue
      for (let h = 0; h < 24; h++) {
        const hitsCount = hitsRow[h] ?? 0
        const volume = heatRow[h] ?? 0
        if (hitsCount === 0) continue
        const score = volume / (hitsCount + 1)
        if (score < bestScore) {
          bestScore = score
          windowBold = `${BR_DAY_NAMES[d]} ${h}h`
        }
      }
    }
    if (!windowBold) {
      let minVol = Infinity
      for (let d = 0; d < 7; d++) {
        const row = heatmap[d]
        if (!row) continue
        for (let h = 0; h < 24; h++) {
          const vol = row[h] ?? 0
          if (vol > 0 && vol < minVol) { minVol = vol; windowBold = `${BR_DAY_NAMES[d]} ${h}h` }
        }
      }
    }

    if (topicBold && windowBold) {
      play = {
        topicBold,
        formulaBold: topFormula.label,
        formulaMult: topFormula.multiplier,
        windowBold,
        windowReason,
      }
    }
  }

  const insights: CompetitorInsights = {
    heatmap,
    hitsHeatmap,
    tags: tagsSorted,
    engagement,
    gaps,
    cadence,
    formulas,
    play,
    ownTagsByChannel,
    competitorTagsByChannel,
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
