import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import * as Sentry from '@sentry/nextjs'

const JOB = 'purge-content-events'
const LOCK_KEY = 'cron:purge-content-events'

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data, error } = await supabase.rpc('purge_content_events')

    if (error) {
      Sentry.captureException(new Error(error.message), {
        tags: { component: 'cron', job: JOB },
      })
      return { status: 'error' as const, err_code: 'rpc_failed', error: error.message }
    }

    const result = data as { purged: number } | null

    try {
      await supabase.from('cron_runs').insert({
        job: JOB,
        status: 'ok',
        items_processed: result?.purged ?? 0,
      })
    } catch {
      /* best-effort */
    }

    return { status: 'ok' as const, ok: true, ...result }
  })
}
