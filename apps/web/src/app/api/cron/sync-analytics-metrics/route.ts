import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { detectViral, getIsoWeek } from '@/lib/youtube/analytics-sync'
import { buildNotification } from '@/lib/youtube/notification-service'
import { detectFatigue, filterFatigueCandidates } from '@/lib/youtube/ab-fatigue'
import * as Sentry from '@sentry/nextjs'

const YT_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2/reports'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('id, channel_id, site_id, subscriber_count')
    .eq('sync_enabled', true)

  if (!channels || channels.length === 0) {
    return NextResponse.json({ status: 'no_channels' })
  }

  let synced = 0
  let errors = 0
  const errorDetails: string[] = []
  const notifications: Array<{ siteId: string; payload: ReturnType<typeof buildNotification> }> = []
  const processedVideos: Array<{ id: string; published_at: string | null; view_count: number }> = []

  for (const channel of channels) {
    try {
      const { accessToken } = await ensureFreshToken(channel.site_id, 'youtube', channel.channel_id)

      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 2)

      const endStr = end.toISOString().split('T')[0]!
      const startStr = start.toISOString().split('T')[0]!

      const url = new URL(YT_ANALYTICS_BASE)
      url.searchParams.set('ids', `channel==${channel.channel_id}`)
      url.searchParams.set('startDate', startStr)
      url.searchParams.set('endDate', endStr)
      // impressions/impressionClickThroughRate are NOT available in YouTube Analytics API v2
      // — the API returns "Unknown identifier". Per-video impression data is only available
      // through YouTube Studio (internal). We sync what's available: views, watch time, engagement.
      url.searchParams.set('metrics', 'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained')
      url.searchParams.set('dimensions', 'video')
      url.searchParams.set('sort', '-views')
      url.searchParams.set('maxResults', '50')

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        Sentry.captureMessage(`sync-analytics-metrics failed for channel ${channel.channel_id}: ${res.status}`)
        errorDetails.push(`${channel.channel_id}: HTTP ${res.status} — ${errBody.slice(0, 200)}`)
        errors++
        continue
      }

      const report = await res.json() as { rows?: (string | number)[][] }
      if (!report.rows?.length) { synced++; continue }

      const { data: videos } = await supabase
        .from('youtube_videos')
        .select('id, youtube_video_id, title, view_count, view_count_yesterday, view_count_delta_today, published_at')
        .eq('channel_id', channel.id)

      const videoMap = new Map((videos ?? []).map(v => [v.youtube_video_id, v]))

      const channelTotalDelta = (videos ?? []).reduce((s, v) => s + (v.view_count_delta_today ?? 0), 0)
      const channelAvg48h = (videos ?? []).length > 0
        ? (channelTotalDelta + (videos ?? []).reduce((s, v) => s + (v.view_count_yesterday ?? 0), 0)) / (videos ?? []).length
        : 0

      const today = new Date().toISOString().split('T')[0]!

      for (const row of report.rows) {
        const videoExternalId = String(row[0])
        const dbVideo = videoMap.get(videoExternalId)
        if (!dbVideo) continue

        const views = Number(row[1])
        const avgDuration = Number(row[3])
        const likes = Number(row[4])
        const comments = Number(row[5])
        const shares = Number(row[6])
        const subsGained = Number(row[7])

        const previousPeriod = dbVideo.view_count_delta_today ?? 0

        await supabase.from('youtube_videos').update({
          avg_view_duration_seconds: avgDuration,
          view_count_delta_today: views,
          view_count_yesterday: previousPeriod,
          last_analytics_sync_at: new Date().toISOString(),
        }).eq('id', dbVideo.id)

        await supabase.from('youtube_video_analytics').upsert({
          youtube_video_id: dbVideo.id,
          site_id: channel.site_id,
          date: today,
          views,
          avg_view_duration_seconds: avgDuration,
          likes,
          comments,
          shares,
          subscribers_gained: subsGained,
        }, { onConflict: 'youtube_video_id,date' })

        if (detectViral(views, previousPeriod, channelAvg48h)) {
          notifications.push({
            siteId: channel.site_id,
            payload: buildNotification({
              type: 'trending_viral',
              videoId: dbVideo.id,
              videoTitle: dbVideo.title ?? 'Video',
              views48h: views + previousPeriod,
              channelAvg48h,
              weekIso: getIsoWeek(new Date()),
            }),
          })
        }

        processedVideos.push({
          id: dbVideo.id,
          published_at: dbVideo.published_at ?? null,
          view_count: dbVideo.view_count ?? 0,
        })
      }

      synced++
    } catch (e) {
      Sentry.captureException(e)
      errorDetails.push(`${channel.channel_id}: ${e instanceof Error ? e.message : String(e)}`)
      errors++
    }
  }

  // Milestone view snapshots — capture view_count at key ages
  const milestones = [
    { column: 'views_at_24h', minAge: 24, maxAge: 48 },
    { column: 'views_at_48h', minAge: 48, maxAge: 72 },
    { column: 'views_at_7d', minAge: 168, maxAge: 192 },
    { column: 'views_at_30d', minAge: 720, maxAge: 744 },
  ] as const

  for (const video of processedVideos) {
    if (!video.published_at) continue
    const ageHours = (Date.now() - new Date(video.published_at).getTime()) / 3_600_000

    for (const ms of milestones) {
      if (ageHours >= ms.minAge && ageHours < ms.maxAge) {
        const { data: existing } = await supabase
          .from('youtube_video_analytics')
          .select(ms.column)
          .eq('youtube_video_id', video.id)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing && !(existing as Record<string, unknown>)[ms.column]) {
          const today = new Date().toISOString().slice(0, 10)
          await supabase
            .from('youtube_video_analytics')
            .update({ [ms.column]: video.view_count })
            .eq('youtube_video_id', video.id)
            .eq('date', today)
        }
      }
    }
  }

  for (const { siteId, payload } of notifications) {
    await supabase.rpc('create_yt_notification', {
      p_site_id: siteId,
      p_type: payload.type,
      p_priority: payload.priority,
      p_title: payload.title,
      p_message: payload.message,
      p_dedup_key: payload.dedup_key,
      p_video_id: payload.video_id ?? null,
      p_suggested_action: payload.suggested_action ?? null,
      p_action_href: payload.action_href ?? null,
    })
  }

  // Phase 3: Fatigue detection (once per site, after all channels processed)
  let fatigueAlerts = 0
  const siteIds = [...new Set(channels.map(c => c.site_id))]

  for (const siteId of siteIds) {
    try {
      const { data: allVideos } = await supabase
        .from('youtube_videos')
        .select('id, published_at, view_count')
        .eq('site_id', siteId)
        .not('published_at', 'is', null)

      const { data: activeTestVideos } = await supabase
        .from('ab_tests')
        .select('youtube_video_id')
        .eq('site_id', siteId)
        .in('status', ['active', 'draft', 'paused', 'queued'])

      const activeVideoIds = new Set((activeTestVideos ?? []).map(t => t.youtube_video_id))
      const candidates = filterFatigueCandidates(allVideos ?? [], activeVideoIds)

      for (const candidate of candidates) {
        const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
        const { data: metrics } = await supabase
          .from('youtube_video_analytics')
          .select('date, ctr, views')
          .eq('youtube_video_id', candidate.id)
          .gte('date', sixtyDaysAgo)
          .order('date', { ascending: true })

        if (!metrics?.length) continue

        const result = detectFatigue(
          metrics.map(m => ({ date: m.date as string, ctr: (m.ctr as number | null) ?? 0, views: (m.views as number | null) ?? 0 })),
          candidate.published_at,
        )

        if (result?.isFatigued) {
          const { data: existing } = await supabase
            .from('youtube_fatigue_alerts')
            .select('id')
            .eq('video_id', candidate.id)
            .eq('status', 'pending')
            .limit(1)
            .maybeSingle()

          if (!existing) {
            await supabase.from('youtube_fatigue_alerts').insert({
              video_id: candidate.id,
              site_id: siteId,
              z_score: result.zScore,
              expected_ctr: result.expectedCtr,
              actual_ctr: result.actualCtr,
            })
            fatigueAlerts++
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e)
    }
  }

  return NextResponse.json({ synced, errors, notifications: notifications.length, fatigueAlerts, ...(errorDetails.length > 0 && { errorDetails }) })
}
