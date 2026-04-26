import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import * as Sentry from '@sentry/nextjs'

const JOB = 'ad-events-aggregate'
const LOCK_KEY = 'cron:ad-events-aggregate'

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (process.env.AD_TRACKING_ENABLED !== 'true') {
    return new Response(null, { status: 204 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data, error } = await supabase.rpc('aggregate_ad_events_yesterday')

    if (error) {
      Sentry.captureException(new Error(error.message), {
        tags: { component: 'cron', job: JOB },
      })
      return { status: 'error' as const, err_code: 'rpc_failed', error: error.message }
    }

    const rows_upserted = typeof data === 'number' ? data : Number(data ?? 0)

    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: 'ok',
        items_processed: rows_upserted,
      })
    } catch {
      /* best-effort */
    }

    return { status: 'ok' as const, ok: true, rows_upserted }
  })
}
