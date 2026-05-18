import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { scoreVideo, computeBaseline } from '@/lib/youtube/scoring'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { buildNotification, buildGroupNotification, shouldAggregate } from '@/lib/youtube/notification-service'
import type { VideoScoreInput } from '@/lib/youtube/scoring-types'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const weekIso = getIsoWeek(new Date())

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, site_id, subscriber_count')
    .eq('sync_enabled', true)

  if (!channels?.length) return NextResponse.json({ status: 'no_channels' })

  let graded = 0
  let flagged = 0

  for (const channel of channels) {
    try {
      const { data: videos } = await supabase
        .from('youtube_videos')
        .select('id, youtube_video_id, title, published_at, view_count, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, traffic_sources')
        .eq('channel_id', channel.id)
        .not('ctr', 'is', null)
        .order('published_at', { ascending: false })
        .limit(50)

      if (!videos?.length) continue

      const videoIds = videos.map(v => v.id)
      const { data: dailyData } = await supabase
        .from('youtube_video_analytics')
        .select('youtube_video_id, date, views, likes, comments, shares, subscribers_gained, impressions')
        .eq('site_id', channel.site_id)
        .in('youtube_video_id', videoIds)
        .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]!)
        .order('date', { ascending: true })

      const dailyByVideo = new Map<string, Array<{ date: string; views: number; likes: number; comments: number; shares: number; subscribers_gained: number; impressions: number }>>()
      for (const row of dailyData ?? []) {
        const arr = dailyByVideo.get(row.youtube_video_id) ?? []
        arr.push(row)
        dailyByVideo.set(row.youtube_video_id, arr)
      }

      const medians = computeBaseline(videos, dailyByVideo, channel.subscriber_count ?? 0)

      const { data: allHistory } = await supabase
        .from('video_grade_history')
        .select('youtube_video_id, grade, score, week_iso')
        .eq('site_id', channel.site_id)
        .in('youtube_video_id', videoIds)
        .order('week_iso', { ascending: false })
        .limit(200)

      const historyByVideo = new Map<string, Array<{ grade: string; score: number; week_iso: string }>>()
      for (const h of allHistory ?? []) {
        const arr = historyByVideo.get(h.youtube_video_id) ?? []
        arr.push(h)
        historyByVideo.set(h.youtube_video_id, arr)
      }

      const gradeDrops: Array<{ videoTitle: string; oldGrade: string; newGrade: string; videoId: string }> = []
      const gradeOrder = { A: 0, B: 1, C: 2, D: 3 } as Record<string, number>

      for (const video of videos) {
        const daily = dailyByVideo.get(video.id) ?? []
        const last28 = daily.filter(d => new Date(d.date).getTime() > Date.now() - 28 * 86400000)
        const totalViews = last28.reduce((s, d) => s + d.views, 0)
        const totalEngagement = last28.reduce((s, d) => s + d.likes + d.comments + d.shares, 0)
        const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0
        const totalSubs = last28.reduce((s, d) => s + d.subscribers_gained, 0)

        const input: VideoScoreInput = {
          videoId: video.id,
          publishedAt: video.published_at ?? new Date().toISOString(),
          ctr: video.ctr ?? 0,
          avgViewPercentage: video.avg_view_percentage ?? 0,
          impressions: video.impressions ?? 0,
          trafficSources: (video.traffic_sources && typeof video.traffic_sources === 'object')
            ? video.traffic_sources as VideoScoreInput['trafficSources']
            : null,
          engagementRate,
          dailyViews: last28.map(d => ({ date: d.date, views: d.views })),
          subscribersGained: totalSubs,
          viewCount: video.view_count ?? 0,
        }

        const scored = scoreVideo(input, medians)

        await supabase.from('video_grade_history').upsert({
          youtube_video_id: video.id,
          site_id: channel.site_id,
          grade: scored.grade,
          score: scored.overall,
          ctr: scored.axes.find(a => a.axis === 'ctr')?.normalized ?? null,
          retention: scored.axes.find(a => a.axis === 'retention')?.normalized ?? null,
          reach: scored.axes.find(a => a.axis === 'reach')?.normalized ?? null,
          engagement: scored.axes.find(a => a.axis === 'engagement')?.normalized ?? null,
          growth: scored.axes.find(a => a.axis === 'growth')?.normalized ?? null,
          sub_impact: scored.axes.find(a => a.axis === 'sub_impact')?.normalized ?? null,
          view_count: video.view_count,
          week_iso: weekIso,
        }, { onConflict: 'youtube_video_id,week_iso' })

        graded++

        const history = historyByVideo.get(video.id) ?? []

        if (history.length >= 2) {
          const prevGrade = history[1]!.grade
          const drop = (gradeOrder[scored.grade] ?? 0) - (gradeOrder[prevGrade] ?? 0)
          if (drop >= 2) {
            gradeDrops.push({ videoTitle: video.title ?? 'Video', oldGrade: prevGrade, newGrade: scored.grade, videoId: video.id })
          }
        }

        if (history.length >= 2) {
          let consecutiveLow = 0
          for (const h of history) {
            if (h.grade === 'C' || h.grade === 'D') consecutiveLow++
            else break
          }
          if (consecutiveLow >= 2) {
            const { data: existingCycle } = await supabase
              .from('optimization_cycles')
              .select('id')
              .eq('youtube_video_id', video.id)
              .eq('site_id', channel.site_id)
              .not('state', 'in', '("resolved","exhausted","unmonitored")')
              .limit(1)
              .single()

            if (!existingCycle) {
              const { data: resolvedCycle } = await supabase
                .from('optimization_cycles')
                .select('id, cooldown_until')
                .eq('youtube_video_id', video.id)
                .eq('site_id', channel.site_id)
                .eq('state', 'resolved')
                .not('cooldown_until', 'is', null)
                .gt('cooldown_until', new Date().toISOString())
                .limit(1)
                .single()

              if (!resolvedCycle) {
                await supabase.from('optimization_cycles').insert({
                  youtube_video_id: video.id,
                  site_id: channel.site_id,
                  state: 'flagged',
                  cycle_number: 1,
                  flagged_at: new Date().toISOString(),
                })
                flagged++
              }
            }
          }
        }
      }

      if (gradeDrops.length > 0) {
        if (shouldAggregate(gradeDrops.length)) {
          const group = buildGroupNotification('grade_drop', gradeDrops, weekIso)
          await supabase.rpc('create_yt_notification', {
            p_site_id: channel.site_id,
            p_type: group.type,
            p_priority: group.priority,
            p_title: group.title,
            p_message: group.message,
            p_dedup_key: group.dedup_key,
            p_action_href: group.action_href ?? null,
          })
        } else {
          for (const drop of gradeDrops) {
            const payload = buildNotification({
              type: 'grade_drop',
              videoId: drop.videoId,
              videoTitle: drop.videoTitle,
              oldGrade: drop.oldGrade,
              newGrade: drop.newGrade,
              weekIso,
            })
            await supabase.rpc('create_yt_notification', {
              p_site_id: channel.site_id,
              p_type: payload.type,
              p_priority: payload.priority,
              p_title: payload.title,
              p_message: payload.message,
              p_dedup_key: payload.dedup_key,
              p_video_id: payload.video_id ?? null,
              p_action_href: payload.action_href ?? null,
            })
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e)
    }
  }

  return NextResponse.json({ graded, flagged, week: weekIso })
}

