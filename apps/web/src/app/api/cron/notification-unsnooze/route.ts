import { withCronLock, newRunId } from '../../../../../lib/logger'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { processUnsnooze } from '@/lib/notifications/cron/unsnooze'

const JOB = 'notification-unsnooze'
const LOCK_KEY = 'cron:notification-unsnooze'

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const result = await processUnsnooze()
    return { status: 'ok' as const, ...result }
  })
}
