import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { logCron, newRunId, withCronLock } from '../../../../../lib/logger'
import { redactMessage } from '../../../../../lib/waitlists/scrub'

const JOB = 'waitlist-retention-sweep'
const LOCK_KEY = 'cron:waitlist-retention-sweep'

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (process.env.WAITLIST_RETENTION_SWEEP_ENABLED !== 'true') {
    logCron({ job: JOB, status: 'skipped' })
    return Response.json({ skipped: 'disabled' }, { status: 200 })
  }
  const supabase = getSupabaseServiceClient()
  return withCronLock(supabase, LOCK_KEY, newRunId(), JOB, async () => {
    const { data: sites, error } = await supabase.from('sites').select('id').eq('cms_enabled', true)
    if (error) throw error
    let swept = 0
    for (const s of sites ?? []) {
      const r = await supabase.rpc('waitlist_retention_sweep', { p_site_id: s.id })
      if (r.error) {
        logCron({ job: JOB, status: 'error', site_id: s.id, err_code: r.error.code })
        Sentry.captureException(
          new Error(`waitlist_retention_sweep ${r.error.code}: ${redactMessage(r.error.message ?? '')}`),
          { tags: { component: 'waitlist', cron: 'retention_sweep' } },
        )
      } else swept++
    }
    Sentry.addBreadcrumb({ category: 'cron', message: JOB, level: 'info', data: { sites: swept } })
    return { status: 'ok' as const, sites: swept }
  })
}
export const GET = handle
export const POST = handle
