import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { syncInstagramAccount } from '@/lib/instagram/sync'
import type { InstagramAccountRow, InstagramSyncMode } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const mode = (req.nextUrl.searchParams.get('mode') ?? 'daily') as InstagramSyncMode
  if (!['daily', 'manual'].includes(mode)) {
    return Response.json({ error: 'invalid mode' }, { status: 400 })
  }

  const accountId = req.nextUrl.searchParams.get('accountId')
  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, `instagram-sync-${mode}`, runId, 'instagram-sync', async () => {
    let query = supabase
      .from('instagram_accounts')
      .select('*')
      .eq('sync_enabled', true)

    if (accountId) {
      query = query.eq('id', accountId)
    }

    const { data: accounts } = await query

    if (!accounts || accounts.length === 0) {
      return { status: 'ok' as const, message: 'no accounts configured' }
    }

    let totalInserted = 0
    let totalUpdated = 0
    let totalCached = 0

    for (const account of accounts as InstagramAccountRow[]) {
      const { data: logRow } = await supabase.from('instagram_sync_log').insert({
        site_id: account.site_id,
        account_id: account.id,
        mode,
        status: 'started',
      }).select('id').single()

      const logId = logRow?.id

      try {
        const result = await syncInstagramAccount(supabase, account)
        totalInserted += result.postsInserted
        totalUpdated += result.postsUpdated
        totalCached += result.mediaCached

        if (logId) {
          await supabase.from('instagram_sync_log').update({
            status: 'completed',
            posts_found: result.postsFound,
            posts_inserted: result.postsInserted,
            posts_updated: result.postsUpdated,
            media_cached: result.mediaCached,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        if (logId) {
          await supabase.from('instagram_sync_log').update({
            status: 'failed',
            error_message: message,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        Sentry.captureException(err, { tags: { component: 'instagram-sync', mode } })
      }
    }

    if (totalInserted > 0 || totalUpdated > 0) {
      revalidateTag('instagram-feed')
    }

    return {
      status: 'ok' as const,
      mode,
      inserted: totalInserted,
      updated: totalUpdated,
      cached: totalCached,
    }
  })
}
