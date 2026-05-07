import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { refreshAccessToken } from '@/lib/instagram/api-client'
import type { InstagramAccountRow } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, 'instagram-token-refresh', runId, 'instagram-token-refresh', async () => {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .not('access_token', 'is', null)
      .lt('token_expires_at', sevenDaysFromNow)

    if (!accounts || accounts.length === 0) {
      return { status: 'ok' as const, message: 'no tokens need refresh' }
    }

    let refreshed = 0
    let failed = 0

    for (const account of accounts as InstagramAccountRow[]) {
      if (!account.access_token) continue

      const { data: logRow } = await supabase.from('instagram_sync_log').insert({
        site_id: account.site_id,
        account_id: account.id,
        mode: 'token_refresh',
        status: 'started',
      }).select('id').single()

      const logId = logRow?.id

      try {
        const { accessToken, expiresIn } = await refreshAccessToken(account.access_token)
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

        await supabase.from('instagram_accounts').update({
          access_token: accessToken,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }).eq('id', account.id)

        if (logId) {
          await supabase.from('instagram_sync_log').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        refreshed++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        if (logId) {
          await supabase.from('instagram_sync_log').update({
            status: 'failed',
            error_message: message,
            completed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        Sentry.captureException(err, {
          tags: { component: 'instagram-token-refresh', account_id: account.id },
        })
        failed++
      }
    }

    return { status: 'ok' as const, refreshed, failed }
  })
}
