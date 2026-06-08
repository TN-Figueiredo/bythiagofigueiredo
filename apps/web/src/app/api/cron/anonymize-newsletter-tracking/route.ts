import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock } from '../../../../../lib/logger'

const JOB = 'anonymize-newsletter-tracking'
const LOCK_KEY = 'cron:anonymize-tracking'
const RETENTION_DAYS = 90
// Grace period beyond the 24h confirmation TTL before hard-deleting
// never-confirmed pending subscriptions (LGPD storage limitation: no
// consent was ever granted to retain this PII).
const PENDING_GRACE_DAYS = 7

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

    const { count: sendsAnon, error: sendsErr } = await supabase
      .from('newsletter_sends')
      .update({ open_ip: null, open_user_agent: null })
      .lt('opened_at', cutoff)
      .not('open_ip', 'is', null)
    // Surface failures: a silent error here means PII was NOT erased (LGPD).
    if (sendsErr) {
      Sentry.captureException(sendsErr, {
        tags: { component: 'cron', job: JOB, phase: 'anonymize_sends' },
      })
    }

    // newsletter_click_events is a VIEW — update the underlying link_clicks table
    // for newsletter-sourced clicks instead.
    const { data: newsletterLinks } = await supabase
      .from('tracked_links' as never)
      .select('id')
      .eq('source_type', 'newsletter')

    const newsletterLinkIds = (newsletterLinks ?? []).map((l: { id: string }) => l.id)

    let clicksAnon = 0
    if (newsletterLinkIds.length > 0) {
      const { count, error: clicksErr } = await supabase
        .from('link_clicks' as never)
        .update({ ip: null, user_agent: null })
        .in('link_id', newsletterLinkIds)
        .lt('clicked_at', cutoff)
        .not('ip', 'is', null)
      if (clicksErr) {
        Sentry.captureException(clicksErr, {
          tags: { component: 'cron', job: JOB, phase: 'anonymize_clicks' },
        })
      }
      clicksAnon = count ?? 0
    }

    // Hard-delete never-confirmed pending subscriptions whose confirmation
    // window expired more than PENDING_GRACE_DAYS ago. These rows hold
    // plaintext email/ip/user_agent with no completed opt-in — unconsented
    // PII retained indefinitely. Wrapped so a failure here can't break the
    // anonymization work above.
    let pendingPurged = 0
    try {
      const pendingCutoff = new Date(
        Date.now() - PENDING_GRACE_DAYS * 86_400_000,
      ).toISOString()

      const { data: purged, error: purgeError } = await supabase
        .from('newsletter_subscriptions')
        .delete()
        .eq('status', 'pending_confirmation')
        .lt('confirmation_expires_at', pendingCutoff)
        .select('id')

      if (purgeError) throw purgeError
      pendingPurged = purged?.length ?? 0
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'cron', job: JOB, phase: 'pending_purge' },
      })
    }

    return {
      status: 'ok' as const,
      sends_anonymized: sendsAnon ?? 0,
      clicks_anonymized: clicksAnon ?? 0,
      pending_purged: pendingPurged,
    }
  })
}

// Vercel Cron invokes endpoints via GET. Without this alias the route is
// POST-only and the scheduled run 405s — i.e. the LGPD anonymization + pending
// purge never actually run on Vercel. Alias GET to POST so the scheduler fires it.
export const GET = POST
