import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { computeViewDeltas, detectViral, getIsoWeek } from '@/lib/youtube/analytics-sync'
import { buildNotification } from '@/lib/youtube/notification-service'
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
  const notifications: Array<{ siteId: string; payload: ReturnType<typeof buildNotification> }> = []

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
      url.searchParams.set('metrics', 'views,impressions,impressionClickThroughRate,averageViewDuration,likes,comments,shares,subscribersGained')
      url.searchParams.set('dimensions', 'video')
      url.searchParams.set('sort', '-views')
      url.searchParams.set('maxResults', '50')

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!res.ok) {
        Sentry.captureMessage(`sync-analytics-metrics failed for channel ${channel.channel_id}: ${res.status}`)
        errors++
        continue
      }

      const report = await res.json() as { rows?: (string | number)[][] }
      if (!report.rows?.length) { synced++; continue }

      const { data: videos } = await supabase
        .from('youtube_videos')
        .select('id, video_id, view_count, view_count_yesterday, view_count_delta_today')
        .eq('channel_id', channel.id)

      const videoMap = new Map((videos ?? []).map(v => [v.video_id, v]))

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
        const impressions = Number(row[2])
        const ctr = Number(row[3])
        const avgDuration = Number(row[4])
        const likes = Number(row[5])
        const comments = Number(row[6])
        const shares = Number(row[7])
        const subsGained = Number(row[8])

        const { delta_today } = computeViewDeltas(
          views,
          dbVideo.view_count ?? 0,
          dbVideo.view_count_delta_today ?? 0,
        )

        await supabase.from('youtube_videos').update({
          view_count: views,
          impressions,
          ctr,
          avg_view_duration_seconds: avgDuration,
          view_count_delta_today: delta_today,
          view_count_yesterday: dbVideo.view_count_delta_today ?? 0,
          last_analytics_sync_at: new Date().toISOString(),
        }).eq('id', dbVideo.id)

        await supabase.from('youtube_video_analytics').upsert({
          youtube_video_id: dbVideo.id,
          site_id: channel.site_id,
          date: today,
          views: delta_today,
          impressions,
          ctr,
          avg_view_duration_seconds: avgDuration,
          likes,
          comments,
          shares,
          subscribers_gained: subsGained,
        }, { onConflict: 'youtube_video_id,date' })

        if (detectViral(delta_today, dbVideo.view_count_yesterday ?? 0, channelAvg48h)) {
          const { data: videoRow } = await supabase
            .from('youtube_videos')
            .select('title')
            .eq('id', dbVideo.id)
            .single()

          notifications.push({
            siteId: channel.site_id,
            payload: buildNotification({
              type: 'trending_viral',
              videoId: dbVideo.id,
              videoTitle: videoRow?.title ?? 'Video',
              views48h: delta_today + (dbVideo.view_count_yesterday ?? 0),
              channelAvg48h,
              weekIso: getIsoWeek(new Date()),
            }),
          })
        }
      }

      synced++
    } catch (e) {
      Sentry.captureException(e)
      errors++
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

  return NextResponse.json({ synced, errors, notifications: notifications.length })
}
