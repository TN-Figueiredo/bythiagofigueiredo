import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { count: expiredNotifications } = await supabase.rpc('expire_old_yt_notifications')

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: staleTasks } = await supabase
    .from('youtube_intelligence_tasks')
    .update({ status: 'stale', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('requested_at', sevenDaysAgo)
    .select('id')

  return NextResponse.json({
    expired_notifications: expiredNotifications ?? 0,
    stale_tasks: staleTasks?.length ?? 0,
  })
}
