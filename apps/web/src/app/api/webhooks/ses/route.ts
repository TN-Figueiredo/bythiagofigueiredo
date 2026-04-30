import { NextResponse } from 'next/server'
import { createVerify } from 'crypto'
import { SesWebhookProcessor } from '@tn-figueiredo/email/webhooks'
import type { NormalizedWebhookEvent } from '@tn-figueiredo/email/webhooks'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

const SNS_CERT_URL_RE = /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//
const certCache = new Map<string, { pem: string; expiresAt: number }>()
const CERT_TTL_MS = 60 * 60 * 1000

async function getCachedCert(url: string): Promise<string> {
  const cached = certCache.get(url)
  if (cached && cached.expiresAt > Date.now()) return cached.pem
  const pem = await fetch(url, { signal: AbortSignal.timeout(5000) }).then(
    (r) => r.text(),
  )
  certCache.set(url, { pem, expiresAt: Date.now() + CERT_TTL_MS })
  return pem
}

async function verifySnsSignature(
  message: Record<string, string>,
): Promise<boolean> {
  const certUrl = message.SigningCertURL
  if (!certUrl || !SNS_CERT_URL_RE.test(certUrl)) return false
  if (message.SignatureVersion !== '1') return false

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

  const verifier = createVerify('SHA1withRSA')
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

  const valid = await verifySnsSignature(body).catch(() => false)
  if (!valid && body.Type !== 'SubscriptionConfirmation') {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
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
      'id, edition_id, subscriber_email, newsletter_editions(site_id, newsletter_type_id)',
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
  const newsletterId = editionData?.newsletter_type_id

  const { data: sub } = await supabase
    .from('newsletter_subscriptions')
    .select('tracking_consent')
    .eq('email', send.subscriber_email)
    .eq('site_id', siteId ?? '')
    .maybeSingle()

  const trackPii = sub?.tracking_consent !== false

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
      await supabase.from('newsletter_click_events').insert({
        send_id: send.id,
        url: event.metadata?.url ?? '',
        ...(trackPii
          ? {
              ip: event.metadata?.ip ?? null,
              user_agent: event.metadata?.userAgent ?? null,
            }
          : {}),
      })
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
      if (event.metadata?.bounceType === 'hard' && siteId && newsletterId) {
        await supabase
          .from('newsletter_subscriptions')
          .update({ status: 'bounced' })
          .eq('email', send.subscriber_email)
          .eq('site_id', siteId)
          .eq('newsletter_id', newsletterId)
      }
      break

    case 'complained':
      await supabase
        .from('newsletter_sends')
        .update({ status: 'complained' })
        .eq('id', send.id)
      if (siteId && newsletterId) {
        await supabase
          .from('newsletter_subscriptions')
          .update({ status: 'complained' })
          .eq('email', send.subscriber_email)
          .eq('site_id', siteId)
          .eq('newsletter_id', newsletterId)
      }
      break
  }

  await supabase
    .from('newsletter_editions')
    .update({ stats_stale: true })
    .eq('id', send.edition_id)
}
