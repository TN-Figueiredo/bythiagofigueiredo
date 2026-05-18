import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'

export const runtime = 'nodejs'

const JOB = 'links-anonymize-clicks'
const LOCK_KEY = 'cron:links-anonymize-clicks'
const RETENTION_DAYS = 30
const BATCH_SIZE = 10_000

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 86_400_000,
    ).toISOString()

    const { count, error } = await supabase
      .from('link_clicks')
      .update({
        ip: null,
        user_agent: null,
        city: null,
        region: null,
        referrer_url: null,
        ad_click_ids: null,
      })
      .lt('clicked_at', cutoff)
      .not('ip', 'is', null)
      .limit(BATCH_SIZE)

    if (error) {
      Sentry.captureException(error, { tags: { links: 'true', component: 'cron-anonymize' } })
      return { status: 'error' as const, error: error.message }
    }

    return { status: 'ok' as const, anonymized: count ?? 0 }
  })
}
