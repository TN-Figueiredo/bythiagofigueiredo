import { timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { syncChannel, YouTubeQuotaError } from '@/lib/youtube/sync'
import { isInPostingWindow } from '@/lib/youtube/schedule-window'
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
  if (!['schedule', 'catchall', 'metrics', 'manual'].includes(rawMode)) {
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

  return withCronLock(supabase, `sync-youtube-${mode}`, runId, 'sync-youtube', async () => {
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

    for (const channel of channels as YouTubeChannelRow[]) {
      if (mode === 'schedule' && !isInPostingWindow(channel.sync_schedules)) {
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

        if (logId) {
          await supabase.from('youtube_sync_log').update({
            status: 'failed',
            error_message: errorMsg,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        if (err instanceof YouTubeQuotaError) {
          return { status: 'error' as const, error: 'quotaExceeded', quota_used: totalQuota }
        }

        Sentry.captureException(err, {
          tags: { component: 'sync-youtube', mode },
          extra: { channelId: channel.id, siteId: channel.site_id },
        })
      }
    }

    if (totalInserted > 0 || totalUpdated > 0) {
      revalidateTag('youtube')
    }

    return {
      status: 'ok' as const,
      mode,
      inserted: totalInserted,
      updated: totalUpdated,
      quota_used: totalQuota,
    }
  })
}
