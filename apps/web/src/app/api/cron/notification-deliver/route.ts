import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { processDeliveryQueue } from '@/lib/notifications/cron/deliver'
import * as Sentry from '@sentry/nextjs'

const JOB = 'notification-deliver'
const LOCK_KEY = 'cron:notification-deliver'

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    try {
      const result = await processDeliveryQueue()
      return { status: 'ok' as const, ok: true, ...result }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { notifications: 'true', component: JOB },
      })
      return {
        status: 'error' as const,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })
}
