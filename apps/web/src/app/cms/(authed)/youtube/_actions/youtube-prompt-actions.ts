'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { fetchYtSearchTerms, fetchYtDemographics } from '@/lib/youtube/analytics-client'
import {
  getChannelTier,
  computeBaseline,
  scoreVideo,
  computeTrend,
  computeOutliers,
  assignGrade,
} from '@/lib/youtube/scoring'
import type { BaselineDailyRow } from '@/lib/youtube/scoring'
import { getMaxCycles } from '@/lib/youtube/optimization-loop'
import {
  aggregateCategoryPerformance,
  detectOutlierSuccesses,
  computeBestPerformingDay,
  computeBestPerformingHour,
} from '@/lib/youtube/prompt-query-helpers'
import type { Axis, Grade } from '@/lib/youtube/scoring-types'
import type {
  ContentCalendarData,
  ChannelHealthData,
  VideoOptimizerData,
  PromptChannelInfo,
  OutlierRow,
} from '@/lib/youtube/prompt-types'
import type { YtDemographics } from '@/lib/youtube/analytics-types'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireReadAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

function computeSnapshotAgeHours(snapshotAt: string): number {
  const ms = Date.now() - new Date(snapshotAt).getTime()
  if (!Number.isFinite(ms)) return -1
  return Math.round((ms / 3_600_000) * 10) / 10
}

function formatDemographics(demo: YtDemographics): {
  topAge: string
  topCountry: string
  topDevice: string
} {
  let topAge = 'unknown'
  if (demo.ageGender.length > 0) {
    const totals = demo.ageGender.map(g => ({ ageGroup: g.ageGroup, total: g.male + g.female }))
    const grandTotal = totals.reduce((s, g) => s + g.total, 0)
    totals.sort((a, b) => b.total - a.total)
    const top = totals[0]!
    const pct = grandTotal > 0 ? Math.round((top.total / grandTotal) * 100) : 0
    topAge = `${top.ageGroup} (${pct}%)`
  }

  const topCountry =
    demo.countries.length > 0
      ? `${demo.countries[0]!.country} (${demo.countries[0]!.percentage}%)`
      : 'unknown'

  const topDevice =
    demo.devices.length > 0
      ? `${demo.devices[0]!.deviceType} (${demo.devices[0]!.percentage}%)`
      : 'unknown'

  return { topAge, topCountry, topDevice }
}

async function getChannelInfo(
  siteId: string,
  channelId?: string,
): Promise<{ info: PromptChannelInfo; channelDbId: string; lastSyncedAt: string } | null> {
  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('youtube_channels')
    .select('id, name, subscriber_count, video_count, last_synced_at')
    .eq('site_id', siteId)
    .eq('sync_enabled', true)

  if (channelId) query = query.eq('id', channelId)

  const { data, error } = await query.order('subscriber_count', { ascending: false }).limit(1).single()
  if (error && error.code !== 'PGRST116') throw error
  if (!data) return null

  const info: PromptChannelInfo = {
    name: data.name as string,
    subscribers: data.subscriber_count as number,
    videoCount: data.video_count as number,
    tier: getChannelTier(data.subscriber_count as number),
  }

  return {
    info,
    channelDbId: data.id as string,
    lastSyncedAt: (data.last_synced_at as string | null) ?? new Date().toISOString(),
  }
}

export async function fetchContentCalendarData(
  channelId?: string,
): Promise<ActionResult<ContentCalendarData>> {
  if (channelId && !UUID_RE.test(channelId))
    return { ok: false, error: 'invalid_input' }

  try {
    const siteId = await requireReadAccess()
    const channelResult = await getChannelInfo(siteId, channelId)
    if (!channelResult) return { ok: false, error: 'No sync-enabled channel found' }

    const { info, channelDbId, lastSyncedAt } = channelResult
    const supabase = getSupabaseServiceClient()

    const [rawSearchTerms, demographics, recentVideosRes, widerVideosRes, categoriesRes] = await Promise.all([
      fetchYtSearchTerms(siteId, 28, channelDbId),
      fetchYtDemographics(siteId, 28, channelDbId),
      supabase
        .from('youtube_videos')
        .select('id, title, published_at, category_id, view_count')
        .eq('site_id', siteId)
        .eq('channel_id', channelDbId)
        .eq('is_hidden', false)
        .order('published_at', { ascending: false })
        .limit(5),
      supabase
        .from('youtube_videos')
        .select('id, title, published_at, category_id, view_count, avg_view_percentage')
        .eq('site_id', siteId)
        .eq('channel_id', channelDbId)
        .eq('is_hidden', false)
        .order('published_at', { ascending: false })
        .limit(100),
      supabase
        .from('youtube_categories')
        .select('id, slug, name_pt, name_en, sort_order')
        .eq('site_id', siteId)
        .order('sort_order'),
    ])

    const truncated = rawSearchTerms.length > 10
    const searchTerms = rawSearchTerms.slice(0, 10)
    const categoryMap = new Map(
      (categoriesRes.data ?? []).map((c: { id: string; slug: string; name_pt: string; name_en: string; sort_order: number }) => [c.id, c]),
    )

    const recentUploads = (recentVideosRes.data ?? []).map(
      (v: { id: string; title: string; published_at: string; category_id: string | null; view_count: number }) => {
        const cat = v.category_id ? categoryMap.get(v.category_id) : null
        return {
          title: v.title as string,
          publishedAt: v.published_at as string,
          categorySlug: cat?.slug ?? '',
        }
      },
    )

    // --- Compute stub fields from wider video set ---
    const widerVideos = (widerVideosRes.data ?? []).map(
      (v: { id: string; title: string; published_at: string; category_id: string | null; view_count: number; avg_view_percentage: number | null }) => ({
        id: v.id as string,
        title: v.title as string,
        category_id: (v.category_id as string | null),
        view_count: (v.view_count as number) ?? 0,
        avg_view_percentage: v.avg_view_percentage as number | null,
        published_at: v.published_at as string,
      }),
    )

    const topPerformingCategories = aggregateCategoryPerformance(widerVideos, categoryMap)
    const outlierSuccesses = detectOutlierSuccesses(widerVideos)
    const bestPerformingDay = computeBestPerformingDay(widerVideos)
    const bestPerformingHour = computeBestPerformingHour(widerVideos)

    const snapshotAt = lastSyncedAt
    const snapshotAgeHours = computeSnapshotAgeHours(snapshotAt)

    const data: ContentCalendarData = {
      channel: info,
      searchTerms,
      topPerformingCategories,
      demographics: formatDemographics(demographics),
      outlierSuccesses,
      bestPerformingDay,
      bestPerformingHour,
      recentUploads,
      snapshotAt,
      snapshotAgeHours,
      truncated,
    }

    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}

export async function fetchChannelHealthData(
  channelId?: string,
): Promise<ActionResult<ChannelHealthData>> {
  if (channelId && !UUID_RE.test(channelId))
    return { ok: false, error: 'invalid_input' }

  try {
    const siteId = await requireReadAccess()
    const channelResult = await getChannelInfo(siteId, channelId)
    if (!channelResult) return { ok: false, error: 'No sync-enabled channel found' }

    const { info, channelDbId, lastSyncedAt } = channelResult
    const supabase = getSupabaseServiceClient()

    const [rawSearchTerms, demographics, videosRes, abTestsRes, cyclesRes, channelRes] = await Promise.all([
      fetchYtSearchTerms(siteId, 28, channelDbId),
      fetchYtDemographics(siteId, 28, channelDbId),
      supabase
        .from('youtube_videos')
        .select('id, youtube_video_id, title, view_count, avg_view_percentage, ctr, traffic_sources, published_at, impressions')
        .eq('site_id', siteId)
        .eq('channel_id', channelDbId)
        .eq('is_hidden', false)
        .order('view_count', { ascending: false })
        .limit(50),
      supabase
        .from('ab_tests')
        .select('name, test_type, winner_variant_id, confidence_at_completion, youtube_video_id')
        .eq('site_id', siteId)
        .eq('status', 'completed')
        .not('winner_variant_id', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(10),
      supabase
        .from('optimization_cycles')
        .select('state')
        .eq('site_id', siteId),
      supabase
        .from('youtube_channels')
        .select('subscriber_count')
        .eq('id', channelDbId)
        .single(),
    ])

    const videos = videosRes.data ?? []
    const subscriberCount = (channelRes.data?.subscriber_count as number | null) ?? info.subscribers

    // --- Fetch video IDs for daily analytics + grade history ---
    const videoIds = videos.map((v: { id: string }) => v.id as string)

    const [dailyRes, gradeHistoryRes] = await Promise.all([
      videoIds.length > 0
        ? supabase
            .from('youtube_video_analytics')
            .select('youtube_video_id, date, views, likes, comments, shares, subscribers_gained, impressions')
            .eq('site_id', siteId)
            .in('youtube_video_id', videoIds)
            .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
            .order('date')
        : Promise.resolve({ data: [] }),
      videoIds.length > 0
        ? supabase
            .from('video_grade_history')
            .select('youtube_video_id, score, week_iso')
            .eq('site_id', siteId)
            .in('youtube_video_id', videoIds)
            .order('week_iso', { ascending: true })
        : Promise.resolve({ data: [] }),
    ])

    // --- Build daily-by-video map ---
    const dailyByVideo = new Map<string, BaselineDailyRow[]>()
    for (const r of (dailyRes.data ?? []) as Array<{ youtube_video_id: string; date: string; views: number; likes: number; comments: number; shares: number; subscribers_gained: number; impressions: number }>) {
      const vid = r.youtube_video_id as string
      const arr = dailyByVideo.get(vid) ?? []
      arr.push({
        date: r.date as string,
        views: r.views as number,
        likes: r.likes as number,
        comments: r.comments as number,
        shares: r.shares as number,
        subscribers_gained: r.subscribers_gained as number,
        impressions: r.impressions as number,
      })
      dailyByVideo.set(vid, arr)
    }

    // --- Compute baseline ---
    const baselineInputs = videos.map(
      (v: { ctr: number | null; avg_view_percentage: number | null; traffic_sources: unknown; view_count: number | null }) => ({
        ctr: v.ctr as number | null,
        avg_view_percentage: v.avg_view_percentage as number | null,
        traffic_sources: v.traffic_sources as unknown,
        view_count: (v.view_count as number | null) ?? 0,
      }),
    )
    const baseline = computeBaseline(baselineInputs, dailyByVideo, subscriberCount)

    // --- Build grade history map per video ---
    const gradeHistoryMap = new Map<string, number[]>()
    for (const row of (gradeHistoryRes.data ?? []) as Array<{ youtube_video_id: string; score: number; week_iso: string }>) {
      const vid = row.youtube_video_id as string
      const arr = gradeHistoryMap.get(vid) ?? []
      arr.push(Number(row.score))
      gradeHistoryMap.set(vid, arr)
    }

    // --- Score each video with full 6-axis scoring ---
    const gradeDistribution: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 }
    const scored = videos.map(
      (v: { id: string; youtube_video_id: string; title: string; view_count: number; avg_view_percentage: number | null; ctr: number | null; traffic_sources: unknown; published_at: string; impressions: number | null }) => {
        const videoDaily = dailyByVideo.get(v.id as string) ?? []
        const dailyViews = videoDaily.map(d => ({ date: d.date, views: d.views }))
        const totalViews = videoDaily.reduce((s, d) => s + d.views, 0)
        const totalLikes = videoDaily.reduce((s, d) => s + (d.likes ?? 0), 0)
        const totalComments = videoDaily.reduce((s, d) => s + (d.comments ?? 0), 0)
        const totalShares = videoDaily.reduce((s, d) => s + (d.shares ?? 0), 0)
        const totalSubsGained = videoDaily.reduce((s, d) => s + (d.subscribers_gained ?? 0), 0)
        const engRate = totalViews > 0 ? ((totalLikes + totalComments + totalShares) / totalViews) * 100 : 0

        const rawTs = v.traffic_sources as Record<string, number> | null
        const ts = rawTs
          ? {
              browse: rawTs.browse ?? 0,
              search: rawTs.search ?? 0,
              suggested: rawTs.suggested ?? 0,
              external: rawTs.external ?? 0,
              direct: rawTs.direct ?? 0,
              notifications: rawTs.notifications ?? 0,
              playlists: rawTs.playlists ?? 0,
            }
          : null

        const result = scoreVideo(
          {
            videoId: v.id as string,
            publishedAt: v.published_at as string,
            ctr: (v.ctr as number | null) ?? 0,
            avgViewPercentage: (v.avg_view_percentage as number | null) ?? 0,
            impressions: (v.impressions as number | null) ?? 0,
            trafficSources: ts,
            engagementRate: engRate,
            dailyViews,
            subscribersGained: totalSubsGained,
            viewCount: (v.view_count as number) ?? 0,
          },
          baseline,
        )

        const grade = result.grade
        gradeDistribution[grade]++

        // Compute per-video trend from grade history
        const weeklyScores = gradeHistoryMap.get(v.id as string) ?? []
        const trend = computeTrend(weeklyScores)

        return {
          id: v.id as string,
          youtubeVideoId: v.youtube_video_id as string,
          title: v.title as string,
          score: result.overall,
          grade,
          retention: (v.avg_view_percentage as number | null) ?? 0,
          trend: trend.direction,
          lifecycleStage: result.lifecycle,
          _axes: result.axes,
        }
      },
    )

    const topVideos = scored
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ _axes: _, ...rest }) => rest)
    const bottomVideos = scored
      .slice()
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map(({ _axes: _, ...rest }) => rest)
    const truncated = rawSearchTerms.length > 10

    // --- Health score: average 6-axis scores across all videos ---
    let healthScore: ChannelHealthData['healthScore'] = null
    if (scored.length > 0) {
      const axisNames: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']
      const axisSums = new Map<Axis, { total: number; count: number }>()
      for (const axis of axisNames) axisSums.set(axis, { total: 0, count: 0 })

      for (const v of scored) {
        for (const a of v._axes) {
          const s = axisSums.get(a.axis)!
          s.total += a.normalized
          s.count++
        }
      }

      const baselineMedians: Record<Axis, number> = {
        ctr: baseline.medianCtr,
        retention: baseline.medianRetention,
        reach: baseline.medianReach,
        engagement: baseline.medianEngagement,
        growth: baseline.medianGrowth,
        sub_impact: baseline.medianSubImpact,
      }

      const healthAxes = axisNames.map(axis => {
        const s = axisSums.get(axis)!
        const avgScore = s.count > 0 ? Math.round((s.total / s.count) * 10) / 10 : 0
        return {
          axis,
          score: avgScore,
          grade: assignGrade(avgScore),
          benchmark: Math.round(baselineMedians[axis] * 10) / 10,
          weight: scored[0]?._axes.find(a => a.axis === axis)?.weight ?? 0,
        }
      })

      const overallHealth = Math.round(
        healthAxes.reduce((sum, a) => sum + a.score * a.weight, 0) * 10,
      ) / 10

      healthScore = { overall: overallHealth, axes: healthAxes }
    }

    // --- Outliers per axis ---
    const positiveOutliers: OutlierRow[] = []
    const negativeOutliers: OutlierRow[] = []
    const outlierAxes: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']
    for (const axis of outlierAxes) {
      const axisScores = scored.map(v => ({
        videoId: v.id,
        score: v._axes.find(a => a.axis === axis)?.normalized ?? 0,
      }))
      const outlierResults = computeOutliers(axisScores, axis)
      for (const o of outlierResults) {
        const v = scored.find(s => s.id === o.videoId)
        if (!v) continue
        const row: OutlierRow = {
          title: v.title,
          modifiedZ: Math.round(o.modifiedZ * 100) / 100,
          views: videos.find((vv: { id: string; view_count: number }) => (vv.id as string) === o.videoId)?.view_count as number ?? 0,
          axis,
        }
        if (o.direction === 'positive') positiveOutliers.push(row)
        else negativeOutliers.push(row)
      }
    }

    // --- AB test results ---
    const abTests = abTestsRes.data ?? []
    const abWinnerVariantIds = abTests
      .map((t: { winner_variant_id: string | null }) => t.winner_variant_id as string)
      .filter(Boolean)

    const winnerLabels = new Map<string, string>()
    if (abWinnerVariantIds.length > 0) {
      const { data: variants } = await supabase
        .from('ab_test_variants')
        .select('id, label')
        .in('id', abWinnerVariantIds)
      for (const vr of (variants ?? []) as Array<{ id: string; label: string }>) {
        winnerLabels.set(vr.id as string, vr.label as string)
      }
    }

    const abTestResults = abTests.map(
      (t: { name: string; test_type: string; winner_variant_id: string | null; confidence_at_completion: number | null }) => ({
        videoTitle: t.name as string,
        testType: t.test_type as string,
        winner: winnerLabels.get(t.winner_variant_id as string) ?? 'unknown',
        confidence: Number(t.confidence_at_completion ?? 0),
      }),
    )

    // --- Cycles summary ---
    const allCycles = cyclesRes.data ?? []
    const activeStates = new Set(['flagged', 'diagnosed', 'test_suggested', 'testing', 'post_test_monitoring', 'retest_needed'])
    const cyclesSummary = { active: 0, resolved: 0, exhausted: 0 }
    for (const c of allCycles as Array<{ state: string }>) {
      if (activeStates.has(c.state as string)) cyclesSummary.active++
      else if ((c.state as string) === 'resolved') cyclesSummary.resolved++
      else if ((c.state as string) === 'exhausted') cyclesSummary.exhausted++
    }

    const snapshotAt = lastSyncedAt
    const snapshotAgeHours = computeSnapshotAgeHours(snapshotAt)

    const data: ChannelHealthData = {
      channel: info,
      healthScore,
      topVideos,
      bottomVideos,
      gradeDistribution,
      demographics: formatDemographics(demographics),
      searchTerms: rawSearchTerms.slice(0, 10),
      outliers: { positive: positiveOutliers, negative: negativeOutliers },
      abTestResults,
      cyclesSummary,
      totalVideos: videos.length,
      showingTopN: Math.min(50, videos.length),
      snapshotAt,
      snapshotAgeHours,
      truncated,
    }

    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}

export async function fetchVideoOptimizerData(
  videoId: string,
): Promise<ActionResult<VideoOptimizerData>> {
  if (!UUID_RE.test(videoId))
    return { ok: false, error: 'invalid_input' }

  try {
    const siteId = await requireReadAccess()
    const supabase = getSupabaseServiceClient()

    const { data: video, error: videoError } = await supabase
      .from('youtube_videos')
      .select('id, title, channel_id, view_count, avg_view_percentage, ctr, published_at, retention_curve, traffic_sources, impressions')
      .eq('id', videoId)
      .eq('site_id', siteId)
      .eq('is_hidden', false)
      .single()

    if (videoError && videoError.code !== 'PGRST116') throw videoError
    if (!video) return { ok: false, error: 'Video not found' }

    const channelResult = await getChannelInfo(siteId, video.channel_id as string)
    if (!channelResult) return { ok: false, error: 'Channel not found' }

    const { info, channelDbId, lastSyncedAt } = channelResult
    const snapshotAt = lastSyncedAt
    const snapshotAgeHours = computeSnapshotAgeHours(snapshotAt)

    // --- Parallel queries: peer videos, grade history, optimization cycle ---
    const [peersRes, gradeHistoryRes, cycleRes] = await Promise.all([
      supabase
        .from('youtube_videos')
        .select('id, ctr, avg_view_percentage, traffic_sources, view_count, published_at')
        .eq('site_id', siteId)
        .eq('channel_id', channelDbId)
        .eq('is_hidden', false)
        .not('ctr', 'is', null)
        .order('published_at', { ascending: false })
        .limit(50),
      supabase
        .from('video_grade_history')
        .select('score, week_iso')
        .eq('youtube_video_id', videoId)
        .eq('site_id', siteId)
        .order('week_iso', { ascending: true })
        .limit(8),
      supabase
        .from('optimization_cycles')
        .select('state, cycle_number, cooldown_until, diagnosis_summary')
        .eq('youtube_video_id', videoId)
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const peers = peersRes.data ?? []
    const allVideoIds = [
      videoId,
      ...peers.filter((p: { id: string }) => (p.id as string) !== videoId).map((p: { id: string }) => p.id as string),
    ]

    // --- Daily analytics for all peers + target (last 90 days) ---
    const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const { data: dailyRows } = await supabase
      .from('youtube_video_analytics')
      .select('youtube_video_id, date, views, likes, comments, shares, subscribers_gained, impressions')
      .eq('site_id', siteId)
      .in('youtube_video_id', allVideoIds)
      .gte('date', cutoff90)
      .order('date')

    const dailyByVideo = new Map<string, BaselineDailyRow[]>()
    for (const r of (dailyRows ?? []) as Array<{ youtube_video_id: string; date: string; views: number; likes: number; comments: number; shares: number; subscribers_gained: number; impressions: number }>) {
      const vid = r.youtube_video_id as string
      const arr = dailyByVideo.get(vid) ?? []
      arr.push({
        date: r.date as string,
        views: r.views as number,
        likes: r.likes as number,
        comments: r.comments as number,
        shares: r.shares as number,
        subscribers_gained: r.subscribers_gained as number,
        impressions: r.impressions as number,
      })
      dailyByVideo.set(vid, arr)
    }

    // --- Compute baseline ---
    const peerInputs = peers.map((p: { ctr: number | null; avg_view_percentage: number | null; traffic_sources: unknown; view_count: number | null }) => ({
      ctr: p.ctr as number | null,
      avg_view_percentage: p.avg_view_percentage as number | null,
      traffic_sources: p.traffic_sources as unknown,
      view_count: (p.view_count as number | null) ?? 0,
    }))
    const baseline = computeBaseline(peerInputs, dailyByVideo, info.subscribers)

    // --- Score the target video ---
    const videoDailyViews = (dailyByVideo.get(videoId) ?? []).map(d => ({ date: d.date, views: d.views }))
    const videoDaily = dailyByVideo.get(videoId) ?? []
    const totalVideoViews = videoDaily.reduce((s, d) => s + d.views, 0)
    const totalVideoLikes = videoDaily.reduce((s, d) => s + (d.likes ?? 0), 0)
    const totalVideoComments = videoDaily.reduce((s, d) => s + (d.comments ?? 0), 0)
    const totalVideoShares = videoDaily.reduce((s, d) => s + (d.shares ?? 0), 0)
    const totalVideoSubsGained = videoDaily.reduce((s, d) => s + (d.subscribers_gained ?? 0), 0)
    const engagementRate = totalVideoViews > 0
      ? ((totalVideoLikes + totalVideoComments + totalVideoShares) / totalVideoViews) * 100
      : 0

    const rawTraffic = video.traffic_sources as Record<string, number> | null

    const videoScoreResult = scoreVideo(
      {
        videoId,
        publishedAt: video.published_at as string,
        ctr: (video.ctr as number | null) ?? 0,
        avgViewPercentage: (video.avg_view_percentage as number | null) ?? 0,
        impressions: (video.impressions as number | null) ?? 0,
        trafficSources: rawTraffic
          ? {
              browse: rawTraffic.browse ?? 0,
              search: rawTraffic.search ?? 0,
              suggested: rawTraffic.suggested ?? 0,
              external: rawTraffic.external ?? 0,
              direct: rawTraffic.direct ?? 0,
              notifications: rawTraffic.notifications ?? 0,
              playlists: rawTraffic.playlists ?? 0,
            }
          : null,
        engagementRate,
        dailyViews: videoDailyViews,
        subscribersGained: totalVideoSubsGained,
        viewCount: (video.view_count as number) ?? 0,
      },
      baseline,
    )

    // --- Axes for prompt context ---
    const axes = videoScoreResult.axes.map(a => ({
      axis: a.axis,
      score: Math.round(a.normalized * 10) / 10,
      channelMedian: Math.round(
        (a.axis === 'ctr' ? baseline.medianCtr
          : a.axis === 'retention' ? baseline.medianRetention
          : a.axis === 'reach' ? baseline.medianReach
          : a.axis === 'engagement' ? baseline.medianEngagement
          : a.axis === 'growth' ? baseline.medianGrowth
          : baseline.medianSubImpact) * 10,
      ) / 10,
      status: (a.normalized >= 50 ? 'above' : 'below') as 'above' | 'below',
    }))

    // --- Trend from grade history ---
    const weeklyScores = (gradeHistoryRes.data ?? []).map(
      (g: { score: number }) => Number(g.score),
    )
    const trendData = computeTrend(weeklyScores)

    // --- Retention curve from video JSONB ---
    const retentionCurve = Array.isArray(video.retention_curve)
      ? (video.retention_curve as number[])
      : []

    // --- Traffic sources: collapse external+direct+notifications+playlists into "other" ---
    let trafficSources = { browse: 0, search: 0, suggested: 0, other: 0 }
    if (rawTraffic) {
      trafficSources = {
        browse: rawTraffic.browse ?? 0,
        search: rawTraffic.search ?? 0,
        suggested: rawTraffic.suggested ?? 0,
        other:
          (rawTraffic.external ?? 0) +
          (rawTraffic.direct ?? 0) +
          (rawTraffic.notifications ?? 0) +
          (rawTraffic.playlists ?? 0),
      }
    }

    // --- Optimization cycle data ---
    const cycle = cycleRes.data as {
      state: string
      cycle_number: number
      cooldown_until: string | null
      diagnosis_summary: string | null
    } | null

    const data: VideoOptimizerData = {
      channel: info,
      grade: {
        score: videoScoreResult.overall,
        grade: videoScoreResult.grade,
        axes,
        trend: trendData.direction,
        streak: trendData.streak,
      },
      retentionCurve,
      trafficSources,
      optimizationState: cycle?.state ?? 'unmonitored',
      cycleNumber: cycle?.cycle_number ?? 0,
      maxCycles: getMaxCycles(),
      cooldownUntil: cycle?.cooldown_until ?? null,
      previousDiagnosis: cycle?.diagnosis_summary ?? null,
      channelBaseline: {
        medianCtr: Math.round(baseline.medianCtr * 100) / 100,
        medianRetention: Math.round(baseline.medianRetention * 100) / 100,
      },
      snapshotAt,
      snapshotAgeHours,
    }

    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}

export interface ChannelOption {
  id: string
  name: string
  locale: string
  handle: string
}

export interface ChannelVideoOption {
  id: string
  youtubeVideoId: string
  title: string
  thumbnailUrl: string | null
  duration: string
  publishedAt: string
  viewCount: number
}

export async function fetchChannels(): Promise<ActionResult<ChannelOption[]>> {
  try {
    const siteId = await requireReadAccess()
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('youtube_channels')
      .select('id, name, locale, handle, subscriber_count')
      .eq('site_id', siteId)
      .eq('sync_enabled', true)
      .order('subscriber_count', { ascending: false })

    if (error) throw error
    return {
      ok: true,
      data: (data ?? []).map(ch => ({
        id: ch.id as string,
        name: ch.name as string,
        locale: (ch.locale as string) ?? 'pt',
        handle: (ch.handle as string) ?? '',
      })),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}

export async function fetchChannelVideos(channelId: string): Promise<ActionResult<ChannelVideoOption[]>> {
  if (!UUID_RE.test(channelId))
    return { ok: false, error: 'invalid_input' }

  try {
    const siteId = await requireReadAccess()
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('youtube_videos')
      .select('id, youtube_video_id, title, thumbnail_url, duration, published_at, view_count')
      .eq('site_id', siteId)
      .eq('channel_id', channelId)
      .eq('is_hidden', false)
      .order('published_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return {
      ok: true,
      data: (data ?? []).map(v => ({
        id: v.id as string,
        youtubeVideoId: v.youtube_video_id as string,
        title: v.title as string,
        thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
        duration: (v.duration as string) ?? 'PT0S',
        publishedAt: (v.published_at as string) ?? new Date().toISOString(),
        viewCount: (v.view_count as number) ?? 0,
      })),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}

const SaveVideoNotesSchema = z.object({
  videoId: z.string().uuid(),
  notes: z.string().max(10000),
  version: z.number().int().min(1),
})

export async function saveVideoNotes(
  videoId: string,
  notes: string,
  version: number,
): Promise<ActionResult<{ version: number }>> {
  const parsed = SaveVideoNotesSchema.safeParse({ videoId, notes, version })
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues.map(i => i.message).join(', ') }

  try {
    const siteId = await requireReadAccess()
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('youtube_videos')
      .update({
        cms_notes: parsed.data.notes,
        version: parsed.data.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.videoId)
      .eq('site_id', siteId)
      .eq('version', parsed.data.version)
      .select('version')
      .single()

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'conflict: version mismatch' }

    revalidateTag('youtube')
    revalidatePath('/cms/youtube/videos')
    return { ok: true, data: { version: data.version as number } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unexpected error'
    return { ok: false, error: msg }
  }
}
