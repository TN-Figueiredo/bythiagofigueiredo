'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { scoreVideo, computeOutliers, computeTrend } from '@/lib/youtube/scoring'
import type { ChannelBaseline, VideoScoreInput } from '@/lib/youtube/scoring-types'
import { revalidateTag } from 'next/cache'

export async function fetchGradesData(channelId: string) {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, video_id, title, thumbnail_url, published_at, view_count, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, retention_curve, traffic_sources')
    .eq('channel_id', channelId)
    .eq('site_id', siteId)
    .not('ctr', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50)

  if (!videos?.length) return { videos: [], outliers: [] }

  const { data: dailyData } = await supabase
    .from('youtube_video_analytics')
    .select('youtube_video_id, date, views, likes, comments, shares, subscribers_gained, impressions')
    .eq('site_id', siteId)
    .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]!)

  const dailyByVideo = new Map<string, Array<{ date: string; views: number; likes: number; comments: number; shares: number; subscribers_gained: number; impressions: number }>>()
  for (const row of dailyData ?? []) {
    const arr = dailyByVideo.get(row.youtube_video_id) ?? []
    arr.push(row)
    dailyByVideo.set(row.youtube_video_id, arr)
  }

  const { data: gradeHistory } = await supabase
    .from('video_grade_history')
    .select('youtube_video_id, score, week_iso')
    .eq('site_id', siteId)
    .order('week_iso', { ascending: false })
    .limit(200)

  const historyByVideo = new Map<string, number[]>()
  for (const h of gradeHistory ?? []) {
    const arr = historyByVideo.get(h.youtube_video_id) ?? []
    arr.push(Number(h.score))
    historyByVideo.set(h.youtube_video_id, arr)
  }

  const { data: cycles } = await supabase
    .from('optimization_cycles')
    .select('youtube_video_id, state')
    .eq('site_id', siteId)
    .not('state', 'in', '("resolved","exhausted","unmonitored")')

  const cycleByVideo = new Map((cycles ?? []).map(c => [c.youtube_video_id, c.state]))

  const { data: intelligence } = await supabase
    .from('youtube_intelligence')
    .select('video_id, recommendations, analysis_text')
    .eq('site_id', siteId)
    .not('video_id', 'is', null)

  const intelByVideo = new Map((intelligence ?? []).map(i => [i.video_id, i]))

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('subscriber_count')
    .eq('id', channelId)
    .single()

  const baseline = computeBaseline(videos, dailyByVideo, channel?.subscriber_count ?? 0)

  const scoredVideos = videos.map(video => {
    const daily = dailyByVideo.get(video.id) ?? []
    const last28 = daily.filter(d => new Date(d.date).getTime() > Date.now() - 28 * 86400000)
    const totalViews = last28.reduce((s, d) => s + d.views, 0)
    const totalEng = last28.reduce((s, d) => s + d.likes + d.comments + d.shares, 0)
    const totalSubs = last28.reduce((s, d) => s + d.subscribers_gained, 0)

    const input: VideoScoreInput = {
      videoId: video.id,
      publishedAt: video.published_at ?? new Date().toISOString(),
      ctr: video.ctr ?? 0,
      avgViewPercentage: video.avg_view_percentage ?? 0,
      impressions: video.impressions ?? 0,
      trafficSources: video.traffic_sources as VideoScoreInput['trafficSources'],
      engagementRate: totalViews > 0 ? (totalEng / totalViews) * 100 : 0,
      dailyViews: last28.map(d => ({ date: d.date, views: d.views })),
      subscribersGained: totalSubs,
      viewCount: video.view_count ?? 0,
    }

    const scored = scoreVideo(input, baseline)
    const weeklyScores = historyByVideo.get(video.id) ?? []
    const trend = computeTrend(weeklyScores)
    const intel = intelByVideo.get(video.id)
    const rec = intel?.recommendations as { reasoning?: string; suggested_variant_description?: string } | null

    return {
      videoId: video.id,
      title: video.title ?? '',
      thumbnailUrl: video.thumbnail_url ?? '',
      grade: scored.grade,
      score: scored.overall,
      axes: scored.axes.map(a => ({ axis: a.axis, normalized: a.normalized })),
      trend: { direction: trend.direction, velocity: trend.velocity },
      optimizationState: cycleByVideo.get(video.id) ?? null,
      retentionCurve: video.retention_curve as number[] | null,
      avgViewPercentage: video.avg_view_percentage ?? 0,
      diagnosis: rec?.reasoning ?? null,
      recommendation: rec?.suggested_variant_description ?? null,
      trafficSources: video.traffic_sources as Record<string, number> | null,
    }
  })

  const ctrScores = scoredVideos.map(v => ({
    videoId: v.videoId,
    score: v.axes.find(a => a.axis === 'ctr')?.normalized ?? 50,
  }))
  const outliers = computeOutliers(ctrScores, 'ctr')

  return { videos: scoredVideos, outliers }
}

export async function fetchNotifications() {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('yt_notifications')
    .select('id, type, priority, title, message, read, action_href, created_at')
    .eq('site_id', siteId)
    .is('expired_at', null)
    .eq('dismissed', false)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  return data ?? []
}

export async function markNotificationRead(notificationId: string) {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  await supabase.from('yt_notifications').update({ read: true }).eq('id', notificationId).eq('site_id', siteId)
  revalidateTag('yt-notifications')
}

export async function markAllNotificationsRead() {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  await supabase.from('yt_notifications').update({ read: true }).eq('site_id', siteId).eq('read', false)
  revalidateTag('yt-notifications')
}

export async function dismissNotification(notificationId: string) {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  await supabase.from('yt_notifications').update({ dismissed: true }).eq('id', notificationId).eq('site_id', siteId)
  revalidateTag('yt-notifications')
}

export async function requestIntelligenceAnalysis(channelId: string) {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: existing } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, requested_at')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .in('status', ['pending', 'running'])
    .limit(1)
    .single()

  if (existing) return { error: 'already_active' }

  const { data: recent } = await supabase
    .from('youtube_intelligence_tasks')
    .select('completed_at')
    .eq('site_id', siteId)
    .eq('channel_id', channelId)
    .eq('trigger_type', 'manual')
    .order('requested_at', { ascending: false })
    .limit(1)
    .single()

  if (recent?.completed_at) {
    const hoursSince = (Date.now() - new Date(recent.completed_at).getTime()) / 3600000
    if (hoursSince < 24) return { error: 'cooldown', hours_remaining: Math.ceil(24 - hoursSince) }
  }

  await supabase.from('youtube_intelligence_tasks').insert({
    site_id: siteId,
    channel_id: channelId,
    trigger_type: 'manual',
  })

  return { ok: true }
}

function computeBaseline(
  videos: Array<{ ctr: number | null; avg_view_percentage: number | null; impressions: number | null }>,
  dailyByVideo: Map<string, Array<{ views: number }>>,
  subscriberCount: number,
): ChannelBaseline {
  const ctrs = videos.map(v => v.ctr ?? 0).filter(c => c > 0).sort((a, b) => a - b)
  const retentions = videos.map(v => v.avg_view_percentage ?? 0).filter(r => r > 0).sort((a, b) => a - b)
  const reaches = videos.map(v => v.impressions ?? 0).filter(r => r > 0).sort((a, b) => a - b)
  const allDaily = Array.from(dailyByVideo.values()).flat()
  const totalViews = allDaily.reduce((s, d) => s + d.views, 0)
  const totalDays = new Set(allDaily.map((d: { views: number }) => JSON.stringify(d))).size || 1
  const median = (arr: number[]) => arr.length === 0 ? 0 : arr[Math.floor(arr.length / 2)]!

  return {
    medianCtr: median(ctrs),
    medianRetention: median(retentions),
    medianReach: median(reaches),
    medianEngagement: 4.0,
    medianGrowth: 0,
    medianSubImpact: 0.5,
    channelDailyMean: totalViews / totalDays,
    subscriberCount,
  }
}
