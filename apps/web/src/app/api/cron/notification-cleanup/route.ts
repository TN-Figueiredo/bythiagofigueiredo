import { withCronLock, newRunId } from '../../../../../lib/logger'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { processCleanup } from '@/lib/notifications/cron/cleanup'

const JOB = 'notification-cleanup'
const LOCK_KEY = 'cron:notification-cleanup'

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const result = await processCleanup()
    return { status: 'ok' as const, ...result }
  })
}
