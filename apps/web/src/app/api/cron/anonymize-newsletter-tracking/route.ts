import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock } from '../../../../../lib/logger'

const JOB = 'anonymize-newsletter-tracking'
const LOCK_KEY = 'cron:anonymize-tracking'
const RETENTION_DAYS = 90

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = crypto.randomUUID()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString()

    const { count: sendsAnon } = await supabase
      .from('newsletter_sends')
      .update({ open_ip: null, open_user_agent: null })
      .lt('opened_at', cutoff)
      .not('open_ip', 'is', null)

    const { count: clicksAnon } = await supabase
      .from('newsletter_click_events')
      .update({ ip: null, user_agent: null })
      .lt('clicked_at', cutoff)
      .not('ip', 'is', null)

    return {
      status: 'ok' as const,
      sends_anonymized: sendsAnon ?? 0,
      clicks_anonymized: clicksAnon ?? 0,
    }
  })
}
