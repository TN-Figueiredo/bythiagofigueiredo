import { timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { syncChannel, YouTubeQuotaError } from '@/lib/youtube/sync'
import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'
import { isInPostingWindow } from '@/lib/youtube/schedule-window'
import { pollVideoStats, shouldSkipPoll, getLastPollTime, insertPollData } from '@/lib/youtube/ab-polls'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import type { YouTubeChannelRow, SyncMode } from '@/lib/youtube/types'

export const runtime = 'nodejs'
export const maxDuration = 300

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected || !authHeader) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const expectedBuf = Buffer.from(`Bearer ${expected}`)
  const actualBuf = Buffer.from(authHeader)
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const rawMode = req.nextUrl.searchParams.get('mode') ?? 'catchall'
  if (!['schedule', 'catchall', 'metrics', 'manual', 'ab-poll', 'competitors'].includes(rawMode)) {
    return Response.json({ error: 'invalid mode' }, { status: 400 })
  }
  const mode = rawMode as SyncMode

  const channelId = req.nextUrl.searchParams.get('channelId')
  if (channelId && !UUID_RE.test(channelId)) {
    return Response.json({ error: 'invalid channelId' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'external service not configured' }, { status: 500 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  const lockKey = channelId ? `sync-youtube-${mode}-${channelId}` : `sync-youtube-${mode}`

  return withCronLock(supabase, lockKey, runId, 'sync-youtube', async () => {
    // AB Lab poll mode — separate flow
    if (mode === 'ab-poll') {
      const { data: activeTests } = await supabase
        .from('ab_tests')
        .select('id, youtube_video_id')
        .eq('status', 'active')

      if (!activeTests?.length) {
        await recordCronSuccess('sync-youtube-ab-poll', 'info')
        return { status: 'ok' as const, mode: 'ab-poll', polled: 0 }
      }

      let polled = 0
      for (const test of activeTests) {
        const lastPoll = await getLastPollTime(supabase, test.id)
        if (shouldSkipPoll(lastPoll)) continue

        // Get external YouTube video ID
        const { data: video } = await supabase
          .from('youtube_videos')
          .select('youtube_video_id')
          .eq('id', test.youtube_video_id)
          .single()

        if (!video?.youtube_video_id) continue

        const stats = await pollVideoStats(video.youtube_video_id, apiKey)
        if (!stats) continue

        // Get the active variant from open cycle
        const { data: openCycle } = await supabase
          .from('ab_test_cycles')
          .select('variant_id')
          .eq('test_id', test.id)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (openCycle?.variant_id) {
          await insertPollData(supabase, test.id, openCycle.variant_id, stats.views, stats.likes, 'cron')
        }
        polled++
      }

      await recordCronSuccess('sync-youtube-ab-poll', 'info')
      return { status: 'ok' as const, mode: 'ab-poll', polled }
    }

    // Competitor observatory mode — separate flow
    if (mode === 'competitors') {
      const { data: competitorChannels } = await supabase
        .from('competitor_channels')
        .select('id, channel_id, site_id')

      if (!competitorChannels?.length) {
        await recordCronSuccess('sync-youtube-competitors', 'info')
        return { status: 'ok' as const, mode: 'competitors', synced: 0 }
      }

      let synced = 0
      for (const channel of competitorChannels) {
        try {
          await syncCompetitorChannel(channel, apiKey)
          synced++
        } catch (err) {
          console.error(`[sync-youtube:competitors] Failed ${channel.channel_id}:`, err)
          Sentry.captureException(err, {
            tags: { component: 'sync-youtube', mode: 'competitors' },
            extra: { channelId: channel.channel_id, siteId: channel.site_id },
          })
        }
      }

      await recordCronSuccess('sync-youtube-competitors', 'info')
      return { status: 'ok' as const, mode: 'competitors', synced }
    }

    let query = supabase
      .from('youtube_channels')
      .select('*')
      .eq('sync_enabled', true)

    if (channelId) {
      query = query.eq('id', channelId)
    }

    const { data: channels } = await query

    if (!channels || channels.length === 0) {
      return { status: 'ok' as const, message: 'no channels configured' }
    }

    let totalInserted = 0
    let totalUpdated = 0
    let totalQuota = 0
    const channelResults: Array<{ id: string; name: string; status: string; detail?: string }> = []

    for (const channel of channels as YouTubeChannelRow[]) {
      if (mode === 'schedule' && !isInPostingWindow(channel.sync_schedules)) {
        channelResults.push({ id: channel.id, name: channel.name, status: 'skipped', detail: 'outside posting window' })
        continue
      }

      const { data: logRow, error: logInsertErr } = await supabase.from('youtube_sync_log').insert({
        site_id: channel.site_id,
        channel_id: channel.id,
        mode,
        status: 'started',
      }).select('id').single()

      if (logInsertErr) {
        Sentry.captureException(logInsertErr, {
          tags: { component: 'sync-youtube', stage: 'log-insert' },
          extra: { channelId: channel.id, siteId: channel.site_id },
        })
      }

      const logId = logRow?.id

      try {
        const result = await syncChannel(supabase, channel, apiKey, mode)
        totalInserted += result.videosInserted
        totalUpdated += result.videosUpdated
        totalQuota += result.quotaUsed
        channelResults.push({
          id: channel.id,
          name: channel.name,
          status: 'completed',
          detail: `found=${result.videosFound} inserted=${result.videosInserted} updated=${result.videosUpdated} quota=${result.quotaUsed}`,
        })

        if (logId) {
          await supabase.from('youtube_sync_log').update({
            status: 'completed',
            videos_found: result.videosFound,
            videos_inserted: result.videosInserted,
            videos_updated: result.videosUpdated,
            quota_used: result.quotaUsed,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const errorMsg = err instanceof YouTubeQuotaError ? 'quotaExceeded' : message
        channelResults.push({ id: channel.id, name: channel.name, status: 'failed', detail: errorMsg })

        if (logId) {
          await supabase.from('youtube_sync_log').update({
            status: 'failed',
            error_message: errorMsg,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        if (err instanceof YouTubeQuotaError) {
          await recordCronFailure('sync-youtube', 'quotaExceeded', 'critical')
          return { status: 'error' as const, error: 'quotaExceeded', quota_used: totalQuota, channels: channelResults }
        }

        Sentry.captureException(err, {
          tags: { component: 'sync-youtube', mode },
          extra: { channelId: channel.id, siteId: channel.site_id },
        })
      }
    }

    revalidateTag('youtube')
    revalidatePath('/cms/youtube')

    const failedChannels = channelResults.filter(c => c.status === 'failed')
    if (failedChannels.length === 0) {
      await recordCronSuccess('sync-youtube', 'critical')
    } else {
      await recordCronFailure('sync-youtube', `${failedChannels.length} channel(s) failed`, 'critical')
    }

    return {
      status: 'ok' as const,
      mode,
      inserted: totalInserted,
      updated: totalUpdated,
      quota_used: totalQuota,
      channels: channelResults,
    }
  })
}
