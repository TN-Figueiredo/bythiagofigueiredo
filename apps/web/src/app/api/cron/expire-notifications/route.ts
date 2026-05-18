import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: expiredCount, error } = await supabase.rpc('expire_old_yt_notifications')
  if (error) Sentry.captureException(error, { extra: { context: 'expire_old_yt_notifications RPC' } })

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: staleTasks } = await supabase
    .from('youtube_intelligence_tasks')
    .update({ status: 'stale', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('requested_at', sevenDaysAgo)
    .select('id')

  return NextResponse.json({
    expired_notifications: expiredCount ?? 0,
    stale_tasks: staleTasks?.length ?? 0,
  })
}
