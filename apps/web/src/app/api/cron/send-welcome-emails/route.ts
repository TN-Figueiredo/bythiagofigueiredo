import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { sendWelcomeEmail } from '../../../../../lib/newsletter/welcome-email'
import { generateUnsubscribeToken } from '../../../../../lib/newsletter/confirm-email'
import { deriveCadenceLabel } from '../../../../../lib/newsletter/format'
import * as Sentry from '@sentry/nextjs'
import type { NewsletterListItem } from '../../../../emails/components/email-newsletter-list'

const BATCH_SIZE = 50
const THROTTLE_MS = 100

// Vercel function timeout. Matches send-scheduled-newsletters — a full batch of
// 50 welcome emails (with per-row SES throttle) can exceed the default 60s.
export const maxDuration = 300

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  // Environment safety — see send-scheduled-newsletters: .env.local points at
  // prod, so a local run of this cron would send REAL welcome mail to REAL
  // subscribers. Only the production Vercel deployment may send; override with
  // ALLOW_LOCAL_NEWSLETTER_SEND=1 for a deliberate local test.
  const liveSendAllowed =
    process.env.VERCEL_ENV === 'production' ||
    process.env.ALLOW_LOCAL_NEWSLETTER_SEND === '1'
  if (!liveSendAllowed) {
    Sentry.captureMessage(
      'send-welcome-emails invoked outside production — skipped (set ALLOW_LOCAL_NEWSLETTER_SEND=1 to override)',
      { level: 'warning', tags: { component: 'cron', job: 'send-welcome-emails' } },
    )
    return Response.json({ status: 'skipped', reason: 'non_production_environment', sent: 0 })
  }

  // CLAIM-BEFORE-SEND (at-most-once semantics).
  //
  // Vercel + pg_cron can both fire this route, and two runs spaced inside the
  // 15-min window can overlap. The old flow (read welcome_sent=false → send →
  // mark true) let both runs read the SAME rows and double-send the welcome.
  //
  // Fix: claim each row by flipping welcome_sent=true BEFORE sending. We first
  // SELECT candidate ids (supabase-js does not reliably bound an UPDATE with
  // .limit(), so we cap the candidate set in the SELECT), then issue a
  // conditional UPDATE gated on welcome_sent=false and .in(claimedIds). The
  // UPDATE is atomic per row: whichever run flips a given row to true first
  // "wins" it; the loser's UPDATE matches zero rows for that id and it is never
  // returned by .select(). We only send to the rows THIS run actually claimed.
  //
  // Tradeoff: if a send fails after the claim, the row is already true and
  // would be permanently skipped. To avoid losing a welcome on a transient SES
  // error we best-effort RESET welcome_sent=false for the failed group so it
  // retries next tick, and always capture the failure to Sentry. (If the reset
  // itself fails, the row stays at-most-once skipped — acceptable for welcome.)
  const { data: candidates } = await supabase
    .from('newsletter_subscriptions')
    .select('id')
    .eq('status', 'confirmed')
    .eq('welcome_sent', false)
    .limit(BATCH_SIZE)

  const candidateIds = (candidates ?? []).map((c) => c.id)
  if (!candidateIds.length) {
    return Response.json({ status: 'ok', sent: 0 })
  }

  // Atomically claim: only rows still welcome_sent=false are flipped + returned.
  // Rows another overlapping run already claimed match zero rows here.
  const { data: pending } = await supabase
    .from('newsletter_subscriptions')
    .update({ welcome_sent: true })
    .eq('welcome_sent', false)
    .in('id', candidateIds)
    .select('id, email, locale, site_id, newsletter_id')

  if (!pending?.length) {
    return Response.json({ status: 'ok', sent: 0 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  // Group by (site_id, email) to send one welcome email per subscriber
  const grouped = new Map<string, typeof pending>()
  for (const sub of pending) {
    const key = `${sub.site_id}:${sub.email}`
    const group = grouped.get(key) ?? []
    group.push(sub)
    grouped.set(key, group)
  }

  let sentCount = 0

  for (const [, subs] of grouped) {
    const first = subs[0]!  // subs always non-empty: only pushed groups enter the Map
    const typeIds = subs.map((s) => s.newsletter_id)

    const { data: types } = await supabase
      .from('newsletter_types')
      .select('name, tagline, color, cadence_label, cadence_days, cadence_start_date, locale')
      .in('id', typeIds)
      .eq('active', true)

    const newsletterNames: NewsletterListItem[] = (types ?? []).map((t) => {
      const typeLocale = (t.locale === 'pt-BR' ? 'pt-BR' : 'en') as 'en' | 'pt-BR'
      const cadence = deriveCadenceLabel(
        t.cadence_label,
        t.cadence_days as number,
        typeLocale,
        t.cadence_start_date as string | null,
      )
      return {
        name: t.name,
        tagline:
          t.tagline && cadence
            ? `${t.tagline} · ${cadence}`
            : (t.tagline ?? cadence ?? ''),
        color: t.color ?? '#FF8240',
      }
    })

    let latestArticle: { title: string; url: string; excerpt?: string } | undefined
    try {
      const { data: post } = await supabase
        .from('posts')
        .select('slug, title, excerpt')
        .eq('site_id', first.site_id)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (post) {
        const locale = first.locale ?? 'pt-BR'
        const prefix = locale === 'pt-BR' ? '/pt' : ''
        latestArticle = {
          title: post.title,
          url: `${appUrl}${prefix}/blog/${post.slug}`,
          excerpt: post.excerpt ?? undefined,
        }
      }
    } catch {
      // best-effort
    }

    try {
      const { raw: rawToken, hash: tokenHash } = generateUnsubscribeToken(first.site_id, first.email)

      await supabase
        .from('unsubscribe_tokens')
        .upsert(
          { site_id: first.site_id, email: first.email, token_hash: tokenHash },
          { onConflict: 'site_id,email', ignoreDuplicates: false },
        )

      const unsubscribeUrl = `${appUrl}/api/newsletters/unsubscribe?token=${rawToken}`

      const sent = await sendWelcomeEmail({
        to: first.email,
        locale: first.locale ?? 'pt-BR',
        newsletterNames,
        latestArticle,
        unsubscribeUrl,
      })

      if (sent) {
        // Row(s) were already claimed (welcome_sent=true) before sending.
        sentCount++
      } else {
        // Send reported failure but did not throw — release the claim so the
        // welcome retries next tick (best-effort) and surface it to Sentry.
        const ids = subs.map((s) => s.id)
        await supabase
          .from('newsletter_subscriptions')
          .update({ welcome_sent: false })
          .in('id', ids)
        Sentry.captureMessage('welcome-email send returned false; claim released for retry', {
          level: 'warning',
          tags: { component: 'cron', job: 'send-welcome-emails' },
        })
      }
    } catch (err) {
      // Send threw after the claim. Best-effort release the claim so a
      // transient SES error retries next tick instead of permanently skipping
      // the welcome (at-most-once tradeoff). If this reset also fails, the row
      // stays claimed and the welcome is skipped.
      try {
        const ids = subs.map((s) => s.id)
        await supabase
          .from('newsletter_subscriptions')
          .update({ welcome_sent: false })
          .in('id', ids)
      } catch {
        // best-effort
      }
      Sentry.captureException(err, {
        tags: { component: 'cron', job: 'send-welcome-emails' },
      })
    }

    await sleep(THROTTLE_MS)
  }

  return Response.json({ status: 'ok', sent: sentCount })
}

// Vercel Cron invokes endpoints via GET. Alias so the Vercel scheduler can
// trigger this job (it previously only ran via pg_cron POST, which was never
// registered for this route — so it never fired).
export const GET = POST
