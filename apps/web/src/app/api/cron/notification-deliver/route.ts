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
      // Importante 4 (docs/superpowers/plans/2026-09-02-falhas-silenciosas.md):
      // processDeliveryQueue used to return only {processed, total}, so this
      // route always answered status:'ok' — and cron_health recorded a
      // success — even when EVERY delivery in the batch failed. Distinguish
      // "the queue was empty" (total===0, genuinely nothing to do) from
      // "the queue had work and none of it got delivered" (total>0,
      // processed===0): only the latter is a real failure. A queue with
      // SOME failures alongside successes stays 'ok' — that's the retry
      // mechanism doing its job, not an outage — but failed/dead are still
      // exposed in the body either way.
      if (result.total > 0 && result.processed === 0) {
        return {
          status: 'error' as const,
          error: `${result.failed} failed, ${result.dead} dead-lettered (0 of ${result.total} delivered)`,
          ...result,
        }
      }
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

// Cron da Vercel dispara GET; auth le o header Authorization independente do verbo, entao o alias e seguro.
export const GET = POST
