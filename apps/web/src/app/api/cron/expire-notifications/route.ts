import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

const CRON_NAME = 'expire-notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: expiredCount, error: rpcError } = await supabase.rpc('expire_old_yt_notifications')
  if (rpcError) {
    Sentry.captureException(rpcError, { extra: { context: 'expire_old_yt_notifications RPC' } })
    await recordCronFailure(CRON_NAME, rpcError.message).catch((e) => console.error('[cron-health] write failed:', e))
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: staleTasks, error: updateError } = await supabase
    .from('youtube_intelligence_tasks')
    .update({ status: 'stale', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('requested_at', sevenDaysAgo)
    .select('id')

  // Esse update tambem pode falhar; o `if (!error)` antigo so refletia o
  // erro da RPC acima e ignorava um erro aqui, gravando sucesso em
  // cron_health com staleTasks === null.
  if (updateError) {
    Sentry.captureException(updateError, { extra: { context: 'stale youtube_intelligence_tasks update' } })
    await recordCronFailure(CRON_NAME, updateError.message).catch((e) => console.error('[cron-health] write failed:', e))
  }

  if (!rpcError && !updateError) {
    await recordCronSuccess(CRON_NAME).catch((e) => console.error('[cron-health] write failed:', e))
  }

  return NextResponse.json({
    expired_notifications: expiredCount ?? 0,
    stale_tasks: staleTasks?.length ?? 0,
  })
}
