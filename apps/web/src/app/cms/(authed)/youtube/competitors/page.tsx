import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { oneEmbed } from '@/lib/supabase/one-embed'
import { getSiteContext } from '@/lib/cms/site-context'
import { getChannelSlots } from '@/lib/youtube/competitor-slots'
import { CompetitorDashboardV2 } from './_components/competitor-dashboard-v2'
import { computeViewGrowthSparkline } from '@/lib/youtube/sparkline-math'
import { computeGrowthScore } from '@/lib/youtube/growth-score'
import { getSubscriberBounds } from '@/lib/youtube/subscriber-resolution'
import { computeSnapshotDelta } from '@/lib/youtube/snapshot-delta'
import { loadRows, rowsToDataset } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { createObservatory } from '@/lib/youtube/observatorio'
import { legacyGrids } from '@/lib/youtube/observatorio/grids'
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

  // ── 2. Observatory rows: one query per table (paged), then the engine — the single calculation layer ──
  const now = observatoryNow()
  const rows = await loadRows({ siteId, now, supabase })
  const obs = createObservatory(rowsToDataset(rows, now))

  // Videos per channel, most recent first, within the channel's video_limit (default 50, max 200).
  type VideoRow = (typeof rows.videos)[number]
  const videoLimitByChannel = new Map(safeChannels.map(ch => [ch.id, Math.min(ch.video_limit ?? 50, 200)]))
  const allVideos: VideoRow[] = []
  {
    const byCh = new Map<string, VideoRow[]>()
    for (const v of [...rows.videos].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))) {
      const list = byCh.get(v.competitor_channel_id) ?? []
      if (list.length < (videoLimitByChannel.get(v.competitor_channel_id) ?? 50)) list.push(v)
      byCh.set(v.competitor_channel_id, list)
    }
    for (const chId of channelIds) allVideos.push(...(byCh.get(chId) ?? []))
  }

  // ── 3. Fetch changes ──
  const { data: rawChanges } = await supabase
    .from('competitor_changes')
    .select('id, change_type, old_title, new_title, old_thumbnail_url, new_thumbnail_url, view_count_at_change, detected_at, bookmarked, competitor_videos!inner(title, video_id, competitor_channels!inner(channel_name, thumbnail_url))')
    .eq('site_id', siteId)
    .order('detected_at', { ascending: false })
    .limit(50)

  // ── 4. Snapshots por canal (últimos 90 dias, do loader; ascendente por data) ──
  const snapshots = [...rows.snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))

  // ── 5. Own channels and their 200 most recent visible videos (from the loader) ──
  const ownChannels = rows.ownChannels
  const ownVideos = [...rows.ownVideos].sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 200)

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
    const vidId = oneEmbed(c.competitor_videos)?.video_id
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
    const subscriberGrowthDelta = computeSnapshotDelta(snaps, 'subscriber_count')

    // View growth delta (exact, not rounded by YouTube)
    const viewGrowthDelta = computeSnapshotDelta(snaps, 'view_count')

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

    // Recent videos as CompetitorVideoView — the multiplier comes from the engine (no local calculation)
    const recentVideos: CompetitorVideoView[] = videos.map(v => {
      const vc = v.view_count ?? 0
      const m = obs.video(v.id)?.mult
      const mult = m && m.value != null && !m.weak ? m.value : null
      const tier = obs.tierOf(mult)
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
        outlierMultiplier: tier ? mult : null,
        outlierTier: tier,
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
    const vidInfo = oneEmbed(c.competitor_videos)
    const chInfo = vidInfo ? oneEmbed(vidInfo.competitor_channels) : null
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
    const vidId = oneEmbed(c.competitor_videos)?.video_id ?? ''
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

  // ── Build outlier views (engine: every age window, long videos) ──
  const chById = new Map(safeChannels.map(ch => [ch.id, ch]))
  const rowThumb = new Map(rows.videos.map(v => [v.id, v.thumbnail_url]))
  const outliers: CompetitorOutlierView[] = obs.outliers({ ages: 'all', fmt: 'long' }).items.map(it => {
    const ch = chById.get(it.video.ch)
    return {
      id: it.video.id,
      videoId: it.video.ytId,
      title: it.video.title,
      thumbnailUrl: it.video.thumbs.at(-1)?.blobUrl ?? rowThumb.get(it.video.id) ?? null,
      channelName: ch?.channel_name ?? obs.channel(it.video.ch)?.name ?? '',
      channelThumbnailUrl: ch?.thumbnail_url ?? null,
      viewCount: it.video.views ?? 0,
      likeCount: it.video.likes,
      commentCount: it.video.comments,
      durationSeconds: it.video.dur,
      publishedAt: new Date(it.video.pub).toISOString(),
      multiplier: Math.round(it.mult.value! * 10) / 10,
      tier: obs.tierOf(it.mult.value)!,
    }
  })

  // ── Build insights ──
  const flatVideos = allVideos ?? []

  // Heatmap: 7x24 (Mon-first day × hour, São Paulo) — engine count per 2 h block, spread onto both hours
  const { heatmap, hitsHeatmap } = legacyGrids(obs)

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

  // ── Cadence per channel (engine: long videos, 13 weeks, habit in São Paulo) ──
  const cadence: CadenceChannel[] = safeChannels.map((ch, idx) => {
    const videos = videosByChannel.get(ch.id) ?? []
    const cad = obs.cadence(ch.id, 'long')
    const cadenceVideos: CadenceVideo[] = videos
      .filter((v): v is VideoRow & { published_at: string } => v.published_at != null)
      .sort((a, b) => b.published_at.localeCompare(a.published_at))
      .map(v => ({ title: v.title ?? '', viewCount: v.view_count ?? 0, publishedAt: v.published_at }))
    return {
      channelName: ch.channel_name,
      channelId: ch.channel_id,
      color: CHANNEL_COLORS[idx % CHANNEL_COLORS.length]!,
      freq: cad.pw,
      window: cad.habit.costuma ? `${BR_DAY_NAMES[(cad.habit.dow! + 6) % 7]} ${cad.habit.hour}h` : '—',
      videos: cadenceVideos,
      lastUploadDays: cad.lastUpload != null ? Math.floor((obs.NOW - cad.lastUpload) / 86_400_000) : -1,
    }
  })

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
      slots={await getChannelSlots(siteId)}
      activeTab={activeTab}
    />
  )
}
