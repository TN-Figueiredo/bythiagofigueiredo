import { revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { getEmailService } from '../../../../../lib/email/service'
import { generateUnsubscribeToken } from '../../../../../lib/newsletter/confirm-email'
import { render } from '@react-email/render'
import { Newsletter } from '../../../../emails/newsletter'
import * as Sentry from '@sentry/nextjs'
import { rewriteLinksForTracking, rewriteLinksUnified } from '../../../../../lib/newsletter/link-tracking'
import { sanitizeForEmail } from '../../../../../lib/newsletter/email-sanitizer'

export const maxDuration = 300

const JOB = 'send-scheduled-newsletters'
const LOCK_KEY = 'cron:send-newsletters'
const BATCH_SIZE = 100
const THROTTLE_MS = 50
const SUBSCRIBER_PAGE_SIZE = 500
// In-run retry passes over sends that threw (transient SES errors). Once the
// edition is marked 'sent' a queued row is never picked up again, so retrying
// before completion is the last chance for that subscriber to get the edition.
const MAX_RETRY_PASSES = 2

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
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    // ── Environment safety ───────────────────────────────────────────────
    // .env.local points at PRODUCTION Supabase + SES. A local `npm run dev`
    // plus a manual hit on this endpoint (or a local scheduler) would claim
    // scheduled editions and send REAL email to REAL subscribers from a dev
    // machine — which is how a test edition once went out 16h off-schedule.
    // Only the production Vercel deployment may send. For a deliberate local
    // test against a throwaway list, set ALLOW_LOCAL_NEWSLETTER_SEND=1.
    const liveSendAllowed =
      process.env.VERCEL_ENV === 'production' ||
      process.env.ALLOW_LOCAL_NEWSLETTER_SEND === '1'
    if (!liveSendAllowed) {
      Sentry.captureMessage(
        'send-scheduled-newsletters invoked outside production — skipped (set ALLOW_LOCAL_NEWSLETTER_SEND=1 to override)',
        { level: 'warning', tags: { component: 'cron', job: JOB } },
      )
      // withCronLock requires status 'ok'|'error' and strips it from the body;
      // expose the skip via a flag so the response is { skipped: true, ... }.
      return { status: 'ok' as const, skipped: true, reason: 'non_production_environment', sent: 0 }
    }

    // ── Delivery reconciliation ──────────────────────────────────────────
    // Opt-in (NEWSLETTER_DELIVERY_RECONCILE=1): only meaningful once the SES
    // 'Delivery' event is published to the SNS topic the webhook consumes.
    // Off by default so it can't false-positive ("0 deliveries") when delivery
    // tracking simply isn't wired yet.
    if (process.env.NEWSLETTER_DELIVERY_RECONCILE === '1') {
      await reconcileDeliveries(supabase)
    }

    // ── Stuck-edition recovery ───────────────────────────────────────────
    // Editions stuck in 'sending' for >2h are likely from a crashed run.
    // Reset them to 'scheduled' so they get retried on the next cycle.
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const { data: stuck } = await supabase
        .from('newsletter_editions')
        .update({ status: 'scheduled' })
        .eq('status', 'sending')
        .lt('updated_at', twoHoursAgo)
        .select('id')
      if (stuck?.length) {
        Sentry.captureMessage(`Recovered ${stuck.length} stuck edition(s)`, {
          level: 'warning',
          tags: { component: 'cron', job: JOB },
          extra: { editionIds: stuck.map((e) => e.id) },
        })
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'cron', job: JOB, phase: 'stuck_recovery' },
      })
    }

    const { data: editions } = await supabase
      .from('newsletter_editions')
      .select('id, newsletter_type_id, subject, preheader, content_html, content_mdx, segment, site_id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())

    if (!editions?.length) return { status: 'ok' as const, sent: 0 }

    let totalSent = 0

    for (const edition of editions) {
      try {
        const sent = await sendEdition(supabase, edition)
        totalSent += sent
      } catch (err) {
        Sentry.captureException(err, {
          tags: { component: 'cron', job: JOB, editionId: edition.id },
        })
      }
    }

    if (totalSent > 0) {
      revalidateTag('newsletter-suggestions')
    }

    return { status: 'ok' as const, sent: totalSent, editions: editions.length }
  })
}

// Vercel Cron invokes endpoints via GET. Alias so the Vercel scheduler can
// trigger this job (it previously only ran via pg_cron POST, which was never
// registered for this route — so it never fired).
export const GET = POST

// ── Delivery reconciliation ────────────────────────────────────────────────
// Finding: delivered_at is NULL across all sends + zero delivery-rate alerting.
// For editions marked 'sent' between 2h and 26h ago, compare how many sends
// were accepted by SES (provider_message_id NOT NULL) against how many have a
// recorded delivery (delivered_at NOT NULL, written by the SNS webhook). If
// nothing — or very little — was delivered, the SES Delivery event / SNS topic
// is almost certainly misconfigured, so alert once (delivery_alerted guard).
// Fully wrapped in try/catch so reconciliation can never break the send path.
async function reconcileDeliveries(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
): Promise<void> {
  try {
    const now = Date.now()
    const lowerBound = new Date(now - 26 * 60 * 60 * 1000).toISOString() // sent_at >= now-26h
    const upperBound = new Date(now - 2 * 60 * 60 * 1000).toISOString() // sent_at <= now-2h (grace for async delivery events)

    const { data: candidates } = await supabase
      .from('newsletter_editions')
      .select('id, subject')
      .eq('status', 'sent')
      .gte('sent_at', lowerBound)
      .lte('sent_at', upperBound)
      .eq('delivery_alerted', false)
      .limit(20)

    if (!candidates?.length) return

    for (const edition of candidates) {
      const { count: sentTotal } = await supabase
        .from('newsletter_sends')
        .select('id', { count: 'exact', head: true })
        .eq('edition_id', edition.id)
        .not('provider_message_id', 'is', null)

      // No accepted sends to reconcile — leave untouched (don't burn the alert).
      if (!sentTotal || sentTotal <= 0) continue

      const { count: deliveredCount } = await supabase
        .from('newsletter_sends')
        .select('id', { count: 'exact', head: true })
        .eq('edition_id', edition.id)
        .not('delivered_at', 'is', null)

      const delivered = deliveredCount ?? 0
      const deliveryRate = (delivered / sentTotal) * 100

      if (delivered === 0) {
        Sentry.captureMessage(
          `Newsletter edition ${edition.id} '${edition.subject}' sent ${sentTotal} but 0 deliveries recorded after 2h — SES Delivery event/SNS likely misconfigured.`,
          {
            level: 'error',
            tags: { component: 'cron', job: JOB, phase: 'reconcile' },
            extra: { editionId: edition.id, sentTotal, deliveredCount: delivered },
          },
        )
        await supabase
          .from('newsletter_editions')
          .update({ delivery_alerted: true })
          .eq('id', edition.id)
      } else if (deliveryRate < 50) {
        Sentry.captureMessage(
          `Newsletter edition ${edition.id} '${edition.subject}' low delivery rate: ${delivered}/${sentTotal} (${deliveryRate.toFixed(1)}%) recorded after 2h.`,
          {
            level: 'warning',
            tags: { component: 'cron', job: JOB, phase: 'reconcile' },
            extra: { editionId: edition.id, sentTotal, deliveredCount: delivered, deliveryRate },
          },
        )
        await supabase
          .from('newsletter_editions')
          .update({ delivery_alerted: true })
          .eq('id', edition.id)
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'cron', job: JOB, phase: 'reconcile' },
    })
  }
}

// NOTE: This deliberately reimplements the send pipeline in-app rather than
// using @tn-figueiredo/newsletter's SendEditionUseCase. The published
// newsletter@0.1.0 SendEditionUseCase still targets the Resend era: it writes
// the `resend_message_id` column and inserts into the `newsletter_click_events`
// view, neither of which exist on the current SES schema (provider_message_id +
// SNS-driven delivered_at). Until that package ships an SES-compatible release,
// it is not drop-in usable here, so this route owns the implementation.
async function sendEdition(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  edition: {
    id: string; newsletter_type_id: string; subject: string; preheader: string | null
    content_html: string | null; content_mdx: string | null; segment: string | null; site_id: string
  },
): Promise<number> {
  const { data: claimed } = await supabase
    .from('newsletter_editions')
    .update({ status: 'sending' })
    .eq('id', edition.id)
    .eq('status', 'scheduled')
    .select('id')

  if (!claimed?.length) return 0

  // Paginated fetch — Supabase silently truncates at max_rows (1000).
  //
  // COMPLETENESS GUARD: a query error mid-pagination MUST abort the edition.
  // Treating an error page as "end of list" would truncate the subscriber set,
  // mark the edition 'sent' with a partial fan-out, and the missing subscribers
  // would never be retried. Throwing leaves the edition in 'sending'; the
  // stuck-edition recovery resets it to 'scheduled' and the next run resumes.
  const subscribers: Array<{ email: string; locale: string | null }> = []
  let offset = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: page, error: pageError } = await supabase
      .from('newsletter_subscriptions')
      .select('email, locale')
      .eq('newsletter_id', edition.newsletter_type_id)
      .eq('site_id', edition.site_id)
      .eq('status', 'confirmed')
      .range(offset, offset + SUBSCRIBER_PAGE_SIZE - 1)
    if (pageError) {
      throw new Error(`subscriber fetch failed at offset ${offset}: ${pageError.message}`)
    }
    if (!page?.length) break
    subscribers.push(...page)
    if (page.length < SUBSCRIBER_PAGE_SIZE) break
    offset += SUBSCRIBER_PAGE_SIZE
  }

  if (!subscribers.length) {
    await supabase.from('newsletter_editions').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_count: 0,
    }).eq('id', edition.id)
    return 0
  }

  const subscriberLocaleMap = new Map<string, string | null>()
  for (const s of subscribers) {
    subscriberLocaleMap.set(s.email, s.locale ?? null)
  }

  const sendRows = subscribers.map((s) => ({
    edition_id: edition.id,
    subscriber_email: s.email,
    status: 'queued',
  }))

  // Chunk upsert into pages of 500 to avoid PostgREST body-size limits.
  // COMPLETENESS GUARD: an upsert error means some subscribers never got a
  // newsletter_sends row — the unsent selector would skip them and the edition
  // would be marked 'sent' without them. Abort instead (edition gets retried).
  const UPSERT_PAGE = 500
  for (let u = 0; u < sendRows.length; u += UPSERT_PAGE) {
    const { error: upsertError } = await supabase.from('newsletter_sends').upsert(
      sendRows.slice(u, u + UPSERT_PAGE),
      { onConflict: 'edition_id,subscriber_email', ignoreDuplicates: true },
    )
    if (upsertError) {
      throw new Error(`newsletter_sends upsert failed at chunk ${u}: ${upsertError.message}`)
    }
  }

  // Paginated fetch of unsent rows — Supabase silently truncates at max_rows (1000).
  //
  // Duplicate-send mitigation (at-least-once delivery): a row where SES accepted
  // the message but the subsequent DB update failed/crashed keeps
  // provider_message_id NULL and would be re-sent after stuck-recovery. We stamp
  // last_attempt_at immediately BEFORE each send (below), so here we exclude rows
  // touched in the last 90 minutes. Semantics: last_attempt_at suppresses
  // immediate re-send of accepted-but-unrecorded rows; combined with the 2h
  // stuck-recovery this keeps the re-send window tightly bounded.
  const reattemptCutoff = new Date(Date.now() - 90 * 60 * 1000).toISOString()
  const unsent: Array<{ id: string; subscriber_email: string }> = []
  let unsentOffset = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: unsentPage, error: unsentError } = await supabase
      .from('newsletter_sends')
      .select('id, subscriber_email')
      .eq('edition_id', edition.id)
      .is('provider_message_id', null)
      .or(`last_attempt_at.is.null,last_attempt_at.lt.${reattemptCutoff}`)
      .range(unsentOffset, unsentOffset + SUBSCRIBER_PAGE_SIZE - 1)
    if (unsentError) {
      throw new Error(`unsent-rows fetch failed at offset ${unsentOffset}: ${unsentError.message}`)
    }
    if (!unsentPage?.length) break
    unsent.push(...unsentPage)
    if (unsentPage.length < SUBSCRIBER_PAGE_SIZE) break
    unsentOffset += SUBSCRIBER_PAGE_SIZE
  }

  // MID-SEND SUPPRESSION: queued rows are a snapshot from fan-out time. On a
  // crash-resume (or any later re-run) a subscriber may have unsubscribed,
  // bounced or complained since the row was created — their subscription is no
  // longer 'confirmed' and they MUST NOT be mailed. Filter the queued rows
  // against the freshly fetched confirmed set; stale rows stay 'queued' with
  // provider_message_id NULL as an audit trail (never dispatched).
  const confirmedEmails = new Set(subscribers.map((s) => s.email.toLowerCase()))
  const eligible = unsent.filter((s) => confirmedEmails.has(s.subscriber_email.toLowerCase()))

  if (!eligible.length) {
    await supabase.from('newsletter_editions').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_count: subscribers.length,
    }).eq('id', edition.id)
    return subscribers.length
  }

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('name, color, sender_name, sender_email, reply_to, max_bounce_rate_pct')
    .eq('id', edition.newsletter_type_id)
    .single()

  const senderName = type?.sender_name ?? 'Thiago Figueiredo'
  const senderEmail = type?.sender_email ?? 'newsletter@bythiagofigueiredo.com'
  const replyTo = type?.reply_to ?? undefined
  // NOTE: despite the DB column name `max_bounce_rate_pct` (kept for schema
  // compatibility), this threshold governs the SES *send-API* error rate — it is
  // a send-error circuit breaker, not a bounce/reputation guard. Real bounces
  // and complaints arrive asynchronously via the SNS webhook, not from this loop.
  const maxSendErrorRatePct = type?.max_bounce_rate_pct ?? 5
  const typeName = type?.name ?? 'Newsletter'
  const typeColor = type?.color ?? '#FF8240'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  const shortDomain: string | null = process.env.LINKS_SHORT_DOMAIN ?? null

  // Derive a campaign slug from the edition subject (best effort, url-safe).
  const campaignSlug = edition.subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  const tokenRows: { site_id: string; email: string; token_hash: string }[] = []
  const tokenMap = new Map<string, string>()

  for (const send of eligible) {
    const { raw, hash } = generateUnsubscribeToken(edition.site_id, send.subscriber_email)
    tokenMap.set(send.subscriber_email, raw)
    tokenRows.push({ site_id: edition.site_id, email: send.subscriber_email, token_hash: hash })
  }

  if (tokenRows.length > 0) {
    // Unsubscribe tokens back the List-Unsubscribe header and per-subscriber
    // unsub URL. If this upsert fails we MUST NOT send: the emails would ship
    // with broken/missing unsubscribe links. So we abort the edition (it gets
    // retried), but first surface the failure to Sentry so a silent token-table
    // problem is observable instead of a bare unhandled throw.
    try {
      const { error: tokenError } = await supabase
        .from('unsubscribe_tokens')
        .upsert(tokenRows, { onConflict: 'site_id,email', ignoreDuplicates: false })
      if (tokenError) throw tokenError
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string } | null)?.code
      Sentry.captureMessage(
        `Newsletter edition ${edition.id} unsubscribe_tokens upsert failed${code ? ` (${code})` : ''}: ${message} — aborting send to avoid broken unsubscribe links.`,
        {
          level: 'error',
          tags: { component: 'cron', job: JOB, phase: 'unsubscribe_tokens' },
          extra: { editionId: edition.id, error: message, code },
        },
      )
      throw err
    }
  }

  // ── Pre-render template ONCE with placeholder tokens ──────────────────
  // sanitizeForEmail + Newsletter + render produce identical output for every
  // subscriber (only unsubscribeUrl and archiveUrl differ). Doing this once
  // changes O(n) renders to O(1), raising the ceiling from ~750 to ~5000+.
  const UNSUB_PLACEHOLDER = '__UNSUB_URL__'
  const ARCHIVE_PLACEHOLDER = '__ARCHIVE_URL__'

  const sanitizedContent = sanitizeForEmail(
    edition.content_html ?? `<p>${edition.content_mdx ?? edition.subject}</p>`,
    typeColor,
  )

  const newsletterTemplate = Newsletter({
    subject: edition.subject,
    preheader: edition.preheader ?? undefined,
    contentHtml: sanitizedContent,
    typeName,
    typeColor,
    unsubscribeUrl: UNSUB_PLACEHOLDER,
    archiveUrl: ARCHIVE_PLACEHOLDER,
  })
  let preRenderedHtml = await render(newsletterTemplate)
  const preRenderedText = await render(newsletterTemplate, { plainText: true })

  // Apply link rewriting ONCE on the pre-rendered HTML (with placeholder unsub URL).
  if (shortDomain) {
    const rewriteResult = await rewriteLinksUnified({
      html: preRenderedHtml,
      supabase,
      siteId: edition.site_id,
      editionId: edition.id,
      shortDomain,
      campaignSlug,
    })
    preRenderedHtml = rewriteResult.html
  }

  const emailService = getEmailService()
  let sentCount = 0
  let errorCount = 0

  // Single send attempt for one queued row. Returns true when SES accepted the
  // message (row stamped with provider_message_id), false when the send threw
  // (row left retryable: status 'queued', provider_message_id NULL,
  // last_attempt_at cleared). Used by the main loop AND the in-run retry passes.
  const attemptSend = async (send: { id: string; subscriber_email: string }): Promise<boolean> => {
    try {
      const unsubToken = tokenMap.get(send.subscriber_email) ?? ''
      const unsubscribeUrl = `${appUrl}/api/newsletters/unsubscribe?token=${unsubToken}`
      const subscriberLocale = subscriberLocaleMap.get(send.subscriber_email) ?? null
      const localePrefix = subscriberLocale === 'pt-BR' ? '/pt' : ''
      const archiveUrl = `${appUrl}${localePrefix}/newsletter/archive/${edition.id}`

      // Fast per-subscriber string replacement instead of full render.
      let html = preRenderedHtml
        .replace(/__UNSUB_URL__/g, unsubscribeUrl)
        .replace(/__ARCHIVE_URL__/g, archiveUrl)
      const text = preRenderedText
        .replace(/__UNSUB_URL__/g, unsubscribeUrl)
        .replace(/__ARCHIVE_URL__/g, archiveUrl)

      // Legacy path: per-subscriber click-tracking rewrite (only when no shortDomain).
      if (!shortDomain) {
        html = rewriteLinksForTracking(html, send.id, appUrl)
      }

      // Claim the row before handing off to SES (at-least-once delivery):
      // if SES accepts but the post-send DB update is lost, this timestamp
      // keeps the row out of the unsent selector for 90 min, preventing an
      // immediate duplicate re-send of an accepted-but-unrecorded message.
      await supabase
        .from('newsletter_sends')
        .update({ last_attempt_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', send.id)

      const result = await emailService.send({
        from: { name: senderName, email: senderEmail },
        to: send.subscriber_email,
        subject: edition.subject,
        html,
        text,
        metadata: {
          configurationSet: process.env.SES_MARKETING_CONFIG_SET ?? 'bythiago-marketing',
          headers: {
            // HTTPS one-click ONLY (RFC 8058). No inbound processing exists
            // for an unsubscribe@ mailbox — advertising a dead mailto would
            // silently swallow unsubscribe attempts and convert them into
            // complaints.
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        },
        ...(replyTo ? { replyTo } : {}),
      })

      // ── SES accepted from here on: the message is out the door. ──────────
      // A post-send recording failure is accepted-but-unrecorded, NOT
      // retry-eligible: keep the pre-send last_attempt_at claim (90-min
      // suppression window) so neither the in-run retry below nor the next
      // cron run re-sends an accepted message. Surface to Sentry instead —
      // the row stays 'queued' with the claim as the durable record. This
      // inner try/catch keeps post-send failures OUT of the outer retry catch.
      try {
        const { error: postSendErr } = await supabase.from('newsletter_sends').update({
          provider_message_id: result.messageId,
          status: 'sent',
          // Record which pipeline was used — the webhook handler reads this.
          link_rewrite_enabled: shortDomain !== null,
        } as Record<string, unknown>).eq('id', send.id)
        if (postSendErr) {
          Sentry.captureException(
            new Error(
              `Post-send update failed for send ${send.id} (message accepted as ${result.messageId}): ${postSendErr.message}`,
            ),
            { tags: { component: 'cron', job: JOB, phase: 'post_send_update', editionId: edition.id, sendId: send.id } },
          )
        }
      } catch (postSendErr) {
        Sentry.captureException(postSendErr, {
          tags: { component: 'cron', job: JOB, phase: 'post_send_update', editionId: edition.id, sendId: send.id },
        })
      }

      sentCount++
      await sleep(THROTTLE_MS)
      return true
    } catch (err) {
      errorCount++
      // Only prep/claim/emailService.send can land here — post-send DB
      // failures are contained above and never reach this retry path.
      // The send threw → SES did NOT accept it, so it's safe (and desirable)
      // to retry. Clear the last_attempt_at claim we stamped pre-send so the
      // 90-min suppression window (meant only for accepted-but-unrecorded rows)
      // doesn't delay this failed row's retry. Best-effort.
      await supabase
        .from('newsletter_sends')
        .update({ last_attempt_at: null } as Record<string, unknown>)
        .eq('id', send.id)
        .then(() => {}, () => {})
      Sentry.captureException(err, {
        tags: { component: 'cron', job: JOB, editionId: edition.id, sendId: send.id },
      })
      return false
    }
  }

  const failedSends: Array<{ id: string; subscriber_email: string }> = []

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)

    for (const send of batch) {
      const ok = await attemptSend(send)
      if (!ok) failedSends.push(send)
    }

    // Send-error circuit breaker (NOT a bounce/reputation guard): errorCount
    // counts SES *send-API* failures (throttling, 5xx, synchronous rejects),
    // never asynchronous bounces/complaints — those arrive via the SNS webhook.
    // If too high a fraction of attempts are erroring, abort the edition rather
    // than keep hammering SES. status='failed' is otherwise invisible, so we
    // emit a Sentry error to surface the silently-abandoned edition.
    const totalAttempted = sentCount + errorCount
    if (totalAttempted >= 10 && (errorCount / totalAttempted) * 100 > maxSendErrorRatePct) {
      const errorRatePct = (errorCount / totalAttempted) * 100
      await supabase.from('newsletter_editions').update({ status: 'failed' }).eq('id', edition.id)
      Sentry.captureMessage(
        `Newsletter edition ${edition.id} aborted: SES send-error rate ${errorRatePct.toFixed(1)}% exceeded threshold ${maxSendErrorRatePct}% (sent ${sentCount}, errors ${errorCount}).`,
        {
          level: 'error',
          tags: { component: 'cron', job: JOB, phase: 'send_error_circuit_breaker', editionId: edition.id },
          extra: { editionId: edition.id, sentCount, errorCount, errorRatePct },
        },
      )
      return sentCount
    }
  }

  // ── In-run retry of transient send failures ────────────────────────────
  // A send that threw stays 'queued' (provider_message_id NULL), but once the
  // edition is marked 'sent' below it is unreachable forever — the editions
  // selector only picks 'scheduled'. So a single transient SES throttle below
  // the circuit-breaker threshold would silently drop that subscriber. Retry
  // the failed subset up to MAX_RETRY_PASSES times before completing; anything
  // still failing is surfaced to Sentry as an error (row stays queued as the
  // durable record of who was missed).
  let remainingFailed = failedSends
  for (let pass = 1; pass <= MAX_RETRY_PASSES && remainingFailed.length > 0; pass++) {
    const stillFailed: typeof remainingFailed = []
    for (const send of remainingFailed) {
      const ok = await attemptSend(send)
      if (!ok) stillFailed.push(send)
    }
    remainingFailed = stillFailed
  }

  if (remainingFailed.length > 0) {
    Sentry.captureMessage(
      `Newsletter edition ${edition.id}: ${remainingFailed.length} send(s) still failing after ${MAX_RETRY_PASSES} retry pass(es) — rows remain queued (provider_message_id NULL) and will NOT be retried automatically once the edition is marked sent.`,
      {
        level: 'error',
        tags: { component: 'cron', job: JOB, phase: 'retry_exhausted', editionId: edition.id },
        extra: {
          editionId: edition.id,
          failedSendIds: remainingFailed.map((s) => s.id),
          sentCount,
          errorCount,
        },
      },
    )
  }

  // Query actual sent count from DB — after crash-resume sentCount only
  // reflects the current run, so we ask the DB for the true total.
  const { count: totalSentCount } = await supabase
    .from('newsletter_sends')
    .select('id', { count: 'exact', head: true })
    .eq('edition_id', edition.id)
    .not('provider_message_id', 'is', null)

  await supabase.from('newsletter_editions').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    send_count: totalSentCount ?? sentCount,
  }).eq('id', edition.id)

  await supabase.from('newsletter_types').update({
    last_sent_at: new Date().toISOString(),
  }).eq('id', edition.newsletter_type_id)

  return sentCount
}
