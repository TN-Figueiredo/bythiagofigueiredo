import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock } from '../../../../../lib/logger'

const JOB = 'purge-webhook-events'
const LOCK_KEY = 'cron:purge-webhooks'

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = crypto.randomUUID()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()

    const { count } = await supabase
      .from('webhook_events')
      .delete()
      .lt('processed_at', cutoff)

    return { status: 'ok' as const, purged: count ?? 0 }
  })
}
