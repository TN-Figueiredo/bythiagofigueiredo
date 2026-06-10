import { NextResponse } from 'next/server'
import { createVerify } from 'crypto'
import { revalidateTag } from 'next/cache'
import { SesWebhookProcessor } from '@tn-figueiredo/email/webhooks'
import type { NormalizedWebhookEvent } from '@tn-figueiredo/email/webhooks'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getServerEnv } from '@/lib/env'
import * as Sentry from '@sentry/nextjs'

const SNS_CERT_URL_RE = /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//
const certCache = new Map<string, { pem: string; expiresAt: number }>()
// Certificate cache TTL: 15min balances latency (avoid fetching cert on every
// webhook) vs. revocation freshness. AWS SNS cert rotation is rare and
// announced; a 15min window is well within acceptable risk for webhook
// signature verification.
const CERT_TTL_MS = 15 * 60 * 1000
// Hard cap on distinct cert URLs cached. There are only ever a handful of real
// AWS SNS signing cert URLs; this bounds the Map so a flood of (signature-
// rejected) requests with novel SigningCertURLs can't grow it without limit.
const CERT_CACHE_MAX = 16

async function getCachedCert(url: string): Promise<string> {
  const cached = certCache.get(url)
  if (cached && cached.expiresAt > Date.now()) return cached.pem
  const pem = await fetch(url, { signal: AbortSignal.timeout(5000) }).then(
    (r) => r.text(),
  )
  certCache.set(url, { pem, expiresAt: Date.now() + CERT_TTL_MS })
  // Evict the oldest entry (Map preserves insertion order) once over the cap.
  if (certCache.size > CERT_CACHE_MAX) {
    const oldest = certCache.keys().next().value
    if (oldest !== undefined) certCache.delete(oldest)
  }
  return pem
}

async function verifySnsSignature(
  message: Record<string, string>,
): Promise<boolean> {
  const certUrl = message.SigningCertURL
  if (!certUrl || !SNS_CERT_URL_RE.test(certUrl)) return false
  // SignatureVersion 1 = SHA1, 2 = SHA256. Node algorithm names are 'RSA-SHA1'/'RSA-SHA256'
  // — the Java-style 'SHA1withRSA' is NOT a valid Node digest and made createVerify THROW,
  // which the caller's .catch(() => false) silently turned into a 401 for EVERY SNS message
  // (no event was ever recorded; new subscriptions could never confirm).
  const algo =
    message.SignatureVersion === '1' ? 'RSA-SHA1'
    : message.SignatureVersion === '2' ? 'RSA-SHA256'
    : null
  if (!algo) return false

  const cert = await getCachedCert(certUrl)

  const fields =
    message.Type === 'Notification'
      ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
      : [
          'Message',
          'MessageId',
          'SubscribeURL',
          'Timestamp',
          'Token',
          'TopicArn',
          'Type',
        ]

  const stringToSign = fields
    .filter((f) => message[f] !== undefined)
    .map((f) => `${f}\n${message[f]}\n`)
    .join('')

  const verifier = createVerify(algo)
  verifier.update(stringToSign)
  return verifier.verify(cert, message.Signature ?? '', 'base64')
}

const processor = new SesWebhookProcessor()

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, string>
  try {
    body = (await req.json()) as Record<string, string>
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Reject an INVALID signature for ALL message types, including
  // SubscriptionConfirmation — verifySnsSignature builds the correct
  // string-to-sign for the non-Notification branch, so legitimately-signed
  // SubscriptionConfirmation messages from AWS still pass. Letting unsigned
  // SubscriptionConfirmation through enabled blind SSRF via SubscribeURL.
  const valid = await verifySnsSignature(body).catch(() => false)
  if (!valid) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  // Validate SNS TopicArn for BOTH Notification and SubscriptionConfirmation.
  if (body.Type === 'Notification' || body.Type === 'SubscriptionConfirmation') {
    const expectedArn = getServerEnv().SNS_EXPECTED_TOPIC_ARN
    if (expectedArn) {
      // Opt-in hardening: when the ARN is configured we bind the webhook to YOUR
      // topic and reject anything else (a validly-signed message from another
      // AWS account would otherwise be trusted).
      if (body.TopicArn !== expectedArn) {
        return NextResponse.json(
          { error: 'topic_arn_mismatch' },
          { status: 403 },
        )
      }
    } else if (
      process.env.VERCEL_ENV === 'production' ||
      process.env.NODE_ENV === 'production'
    ) {
      // Non-breaking by default: if the ARN is unset we still accept the
      // (already signature-verified) message so the webhook keeps working, but
      // surface a warning so the operator can opt into topic binding. We do NOT
      // 500 here — that would silently break bounce/complaint/delivery handling
      // for anyone who hasn't set the var yet.
      Sentry.captureMessage(
        'SNS_EXPECTED_TOPIC_ARN unset — set it to bind the SES webhook to your topic (accepting any signed topic for now)',
        { level: 'warning', tags: { component: 'webhook', provider: 'ses' } },
      )
    }
  }

  if (body.Type === 'SubscriptionConfirmation') {
    try {
      await processor.handleSubscriptionConfirmation(body)
      return NextResponse.json({ ok: true, subscribed: true })
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'webhook', provider: 'ses' },
      })
      return NextResponse.json(
        { error: 'subscription_failed' },
        { status: 500 },
      )
    }
  }

  if (body.Type !== 'Notification') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const snsMessageId = body.MessageId
  const supabase = getSupabaseServiceClient()

  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('idempotency_key', snsMessageId)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, dedup: true })

  let events: NormalizedWebhookEvent[]
  try {
    events = await processor.process(body)
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'webhook', provider: 'ses' },
    })
    return NextResponse.json({ error: 'process_failed' }, { status: 500 })
  }

  // Process before recording idempotency: all DB updates are idempotent (overwrite),
  // so double-processing on SNS retry is safe. Recording first would risk lost events.
  for (const event of events) {
    try {
      await processEvent(supabase, event)
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'webhook', provider: 'ses' },
      })
    }
  }

  // Invalidate suggestion cache when subscriber counts change (bounces/complaints)
  const hasSubscriberChange = events.some(
    (e) => e.type === 'bounced' || e.type === 'complained',
  )
  if (hasSubscriberChange) {
    revalidateTag('newsletter-suggestions')
  }

  await supabase
    .from('webhook_events')
    .insert({
      idempotency_key: snsMessageId,
      event_type: events[0]?.type ?? body.Type,
    })
    .then(
      () => {},
      () => {},
    )

  return NextResponse.json({ ok: true })
}

async function processEvent(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  event: NormalizedWebhookEvent,
) {
  const { data: send } = await supabase
    .from('newsletter_sends')
    .select(
      'id, edition_id, subscriber_email, link_rewrite_enabled, newsletter_editions(site_id, newsletter_type_id)',
    )
    .eq('provider_message_id', event.messageId)
    .maybeSingle()

  if (!send) return

  const editionData = Array.isArray(send.newsletter_editions)
    ? (send.newsletter_editions[0] as
        | { site_id: string; newsletter_type_id: string }
        | undefined)
    : (send.newsletter_editions as {
        site_id: string
        newsletter_type_id: string
      } | null)
  const siteId = editionData?.site_id

  const { data: sub } = await supabase
    .from('newsletter_subscriptions')
    .select('tracking_consent')
    .eq('email', send.subscriber_email)
    .eq('site_id', siteId ?? '')
    .maybeSingle()

  // fail closed: only record PII when consent is explicitly granted; a
  // missing/erased subscription row must not default to tracking.
  const trackPii = sub?.tracking_consent === true

  switch (event.type) {
    case 'delivered':
      await supabase
        .from('newsletter_sends')
        .update({
          status: 'delivered',
          delivered_at: event.timestamp,
        })
        .eq('id', send.id)
      break

    case 'opened':
      await supabase
        .from('newsletter_sends')
        .update({
          status: 'opened',
          opened_at: event.timestamp,
          ...(trackPii
            ? {
                open_ip: event.metadata?.ip ?? null,
                open_user_agent: event.metadata?.userAgent ?? null,
              }
            : {}),
        })
        .eq('id', send.id)
      break

    case 'clicked': {
      await supabase
        .from('newsletter_sends')
        .update({
          status: 'clicked',
          clicked_at: event.timestamp,
        })
        .eq('id', send.id)

      const clickedUrl = event.metadata?.url ?? ''

      // Shared helper: record a click into link_clicks for a resolved
      // tracked_link id. newsletter_click_events is a NON-UPDATABLE JOIN VIEW
      // — never insert into it (writes silently fail).
      //
      // link_clicks columns are link_id + site_id (both NOT NULL) + clicked_at +
      // optional PII. The click's source (newsletter/edition) is NOT stored here:
      // source_type/source_id live on tracked_links and are resolved at read-time
      // via the link_id → tracked_links join (see links_redesign_views). Writing
      // source_type/source_id here previously failed silently (PGRST204) AND the
      // missing NOT NULL site_id would have rejected the row regardless — so every
      // newsletter click was lost. We now insert the real columns and surface any
      // error instead of discarding it.
      const recordLinkClick = async (linkId: string) => {
        const { error } = await supabase.from('link_clicks' as never).insert({
          link_id: linkId,
          site_id: siteId ?? '',
          ...(trackPii
            ? {
                ip: event.metadata?.ip ?? null,
                user_agent: event.metadata?.userAgent ?? null,
              }
            : {}),
          clicked_at: event.timestamp,
        } as never)
        if (error) {
          Sentry.captureMessage('failed to record newsletter click into link_clicks', {
            level: 'warning',
            tags: { component: 'webhook', provider: 'ses' },
            extra: { linkId, code: (error as { code?: string }).code, message: error.message },
          })
        }
      }

      if ((send as Record<string, unknown>).link_rewrite_enabled) {
        // Unified path: find the tracked_link by its destination URL
        // (SES follows redirects before firing the event, so the URL is
        // the original destination, not the short URL).
        const { data: trackedLink } = await supabase
          .from('tracked_links' as never)
          .select('id')
          .eq('site_id', siteId ?? '')
          .eq('destination_url', clickedUrl)
          .maybeSingle()

        if (trackedLink) {
          await recordLinkClick((trackedLink as { id: string }).id)
        } else {
          // Fallback: a unified send normally creates the tracked_link at send
          // time (rewriteLinksUnified, with a generated `code`), so a miss here
          // is an edge case (e.g. destination changed). We do NOT synthesize a
          // tracked_link: link_clicks.link_id is a required FK, and tracked_links
          // requires a NOT NULL `code` from generate_link_code() plus a unique
          // (site_id, code) — an upsert on (site_id, destination_url) would fail.
          // The click's clicked_at/status is already recorded on newsletter_sends;
          // surface the per-link attribution loss so it's visible.
          Sentry.captureMessage(
            'newsletter click: no tracked_link for destination; per-link attribution skipped (clicked_at recorded on the send)',
            {
              level: 'warning',
              tags: { component: 'webhook', provider: 'ses' },
              extra: { siteId: siteId ?? null, clickedUrl },
            },
          )
        }
      } else {
        // Genuinely legacy send (pre-unification): no tracked_link exists and
        // there is no clean way to synthesize one. Do NOT insert into the
        // broken newsletter_click_events view — emit a warning so the loss is
        // visible and rely on the already-recorded clicked_at / status above.
        Sentry.captureMessage(
          'legacy newsletter click could not be persisted (no tracked_link); recorded clicked_at only',
          {
            level: 'warning',
            tags: { component: 'webhook', provider: 'ses' },
          },
        )
      }
      break
    }

    case 'bounced':
      await supabase
        .from('newsletter_sends')
        .update({
          status: 'bounced',
          bounce_type: event.metadata?.bounceType === 'hard' ? 'Permanent' : 'Transient',
        })
        .eq('id', send.id)
      if (event.metadata?.bounceType === 'hard' && siteId) {
        // complaint/hard-bounce = global opt-out across all of this
        // subscriber's lists on the site (CAN-SPAM/LGPD consent withdrawal).
        await supabase
          .from('newsletter_subscriptions')
          .update({ status: 'bounced' })
          .eq('email', send.subscriber_email)
          .eq('site_id', siteId)
          .neq('status', 'unsubscribed')
      }
      break

    case 'complained':
      await supabase
        .from('newsletter_sends')
        .update({ status: 'complained' })
        .eq('id', send.id)
      if (siteId) {
        // complaint/hard-bounce = global opt-out across all of this
        // subscriber's lists on the site (CAN-SPAM/LGPD consent withdrawal).
        await supabase
          .from('newsletter_subscriptions')
          .update({ status: 'complained' })
          .eq('email', send.subscriber_email)
          .eq('site_id', siteId)
          .neq('status', 'unsubscribed')
      }
      break
  }

  await supabase
    .from('newsletter_editions')
    .update({ stats_stale: true })
    .eq('id', send.edition_id)
}
