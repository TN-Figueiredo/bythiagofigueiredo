import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { syncChannel, YouTubeQuotaError } from '@/lib/youtube/sync'
import { isInPostingWindow } from '@/lib/youtube/schedule-window'
import type { YouTubeChannelRow, SyncMode } from '@/lib/youtube/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const mode = (req.nextUrl.searchParams.get('mode') ?? 'catchall') as SyncMode
  if (!['schedule', 'catchall', 'metrics', 'manual'].includes(mode)) {
    return Response.json({ error: 'invalid mode' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 500 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, `sync-youtube-${mode}`, runId, 'sync-youtube', async () => {
    const { data: channels } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('sync_enabled', true)

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

      const logEntry = {
        site_id: channel.site_id,
        channel_id: channel.id,
        mode,
        status: 'started' as const,
      }

      await supabase.from('youtube_sync_log').insert(logEntry)

      try {
        const result = await syncChannel(supabase, channel, apiKey, mode)
        totalInserted += result.videosInserted
        totalUpdated += result.videosUpdated
        totalQuota += result.quotaUsed

        await supabase.from('youtube_sync_log').insert({
          ...logEntry,
          status: 'completed',
          videos_found: result.videosFound,
          videos_inserted: result.videosInserted,
          videos_updated: result.videosUpdated,
          quota_used: result.quotaUsed,
          completed_at: new Date().toISOString(),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        if (err instanceof YouTubeQuotaError) {
          await supabase.from('youtube_sync_log').insert({
            ...logEntry, status: 'failed', error_message: 'quotaExceeded',
            completed_at: new Date().toISOString(),
          })
          return { status: 'error' as const, error: 'quotaExceeded', quota_used: totalQuota }
        }

        Sentry.captureException(err, { tags: { component: 'sync-youtube', mode } })
        await supabase.from('youtube_sync_log').insert({
          ...logEntry, status: 'failed', error_message: message,
          completed_at: new Date().toISOString(),
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
