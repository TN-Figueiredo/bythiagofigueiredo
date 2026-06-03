import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock } from '../../../../../lib/logger'

const JOB = 'anonymize-newsletter-tracking'
const LOCK_KEY = 'cron:anonymize-tracking'
const RETENTION_DAYS = 90

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
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

    // newsletter_click_events is a VIEW — update the underlying link_clicks table
    // for newsletter-sourced clicks instead.
    const { data: newsletterLinks } = await supabase
      .from('tracked_links' as never)
      .select('id')
      .eq('source_type', 'newsletter')

    const newsletterLinkIds = (newsletterLinks ?? []).map((l: { id: string }) => l.id)

    let clicksAnon = 0
    if (newsletterLinkIds.length > 0) {
      const { count } = await supabase
        .from('link_clicks' as never)
        .update({ ip: null, user_agent: null })
        .in('link_id', newsletterLinkIds)
        .lt('clicked_at', cutoff)
        .not('ip', 'is', null)
      clicksAnon = count ?? 0
    }

    return {
      status: 'ok' as const,
      sends_anonymized: sendsAnon ?? 0,
      clicks_anonymized: clicksAnon ?? 0,
    }
  })
}
